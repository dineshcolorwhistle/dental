import {
  Injectable,
  UnauthorizedException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, ResetPasswordDto, ForgotPasswordDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { UserRole } from '@prisma/client';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Authenticate user with email/password.
   * Supports tenant-scoped login (via subdomain) and super admin login.
   */
  async login(dto: LoginDto) {
    const { email, password, subdomain, role } = dto;

    let user;

    if (subdomain) {
      // Tenant-scoped login
      const tenant = await this.prisma.tenant.findUnique({
        where: { subdomain },
      });

      if (!tenant) {
        throw new UnauthorizedException('Invalid tenant');
      }

      if (tenant.status !== 'ACTIVE') {
        throw new UnauthorizedException('Tenant is inactive or suspended');
      }

      // Query all matching users in this tenant only
      const matchingUsers = await this.prisma.user.findMany({
        where: { email, tenantId: tenant.id },
      });

      if (matchingUsers.length === 0) {
        // If no matching users in this tenant, but a Super Admin exists with this email, deny subdomain access
        const superAdminExists = await this.prisma.user.findFirst({
          where: { email, tenantId: null, role: UserRole.SUPER_ADMIN },
        });
        if (superAdminExists) {
          throw new UnauthorizedException('Super Admins cannot log in through tenant subdomains');
        }

        // Also check if the user exists but belongs to a different tenant
        const differentTenantUser = await this.prisma.user.findFirst({
          where: { email, NOT: { tenantId: tenant.id } },
        });
        if (differentTenantUser) {
          throw new UnauthorizedException('You do not have access to this tenant subdomain');
        }

        throw new UnauthorizedException('Invalid credentials');
      }

      // Check passwords for matching users
      let verifiedUser = null;
      for (const u of matchingUsers) {
        if (await bcrypt.compare(password, u.passwordHash)) {
          verifiedUser = u;
          break;
        }
      }

      if (!verifiedUser) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Filter to only active accounts
      const activeUsers = matchingUsers.filter(u => u.status === 'ACTIVE');
      if (activeUsers.length === 0) {
        throw new UnauthorizedException('Account is inactive');
      }

      // Filter active users to allowed roles: OWNER, ADMIN, TECHNICIAN
      const allowedRoles: UserRole[] = [UserRole.OWNER, UserRole.ADMIN, UserRole.TECHNICIAN];
      const activeTenantUsers = activeUsers.filter(u => allowedRoles.includes(u.role));

      if (activeTenantUsers.length === 0) {
        throw new UnauthorizedException('You do not have access to this tenant subdomain');
      }

      // If they have multiple active roles in this tenant (e.g. OWNER and ADMIN)
      if (activeTenantUsers.length > 1) {
        if (role) {
          const selectedUser = activeTenantUsers.find(u => u.role === role);
          if (!selectedUser) {
            throw new UnauthorizedException('Selected role is not available for this account');
          }
          user = selectedUser;
        } else {
          // Send response indicating role selection is required
          return {
            requiresRoleSelection: true,
            roles: activeTenantUsers.map(u => u.role),
            email,
            subdomain,
          };
        }
      } else {
        user = activeTenantUsers[0];
      }
    } else {
      // Super admin login (tenantId is null)
      user = await this.prisma.user.findFirst({
        where: { email, tenantId: null, role: UserRole.SUPER_ADMIN },
      });

      if (!user) {
        // If a non-super admin tries to log in on the primary domain, deny access
        const regularUser = await this.prisma.user.findFirst({
          where: { email, NOT: { role: UserRole.SUPER_ADMIN } },
        });
        if (regularUser) {
          throw new UnauthorizedException('Only Super Admins can log in through the primary domain');
        }

        throw new UnauthorizedException('Invalid credentials');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Account is inactive');
      }
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Fetch tenant name if tenantId exists
    let tenantName: string | null = null;
    let maxAdmins: number | null = null;
    let maxTechnicians: number | null = null;
    if (user.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { name: true, maxAdmins: true, maxTechnicians: true },
      });
      tenantName = tenant?.name || null;
      maxAdmins = tenant?.maxAdmins || null;
      maxTechnicians = tenant?.maxTechnicians || null;
    }

    // Fetch branch name if branchId exists
    let branchName: string | null = null;
    if (user.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: user.branchId },
        select: { name: true },
      });
      branchName = branch?.name || null;
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    this.logger.log(`User logged in: ${user.email} (${user.role})`);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        tenantName,
        branchId: user.branchId,
        branchName,
        maxAdmins,
        maxTechnicians,
        preferredLanguage: user.preferredLanguage,
      },
      ...tokens,
    };
  }

  /**
   * Refresh access token using a valid refresh token.
   */
  async refreshTokens(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Allow a 15-second grace period for concurrent refresh requests (avoids page-load race conditions)
    const gracePeriodMs = 15000;
    const isRevoked = stored.revokedAt !== null;
    const isWithinGracePeriod = isRevoked && stored.revokedAt!.getTime() > Date.now() - gracePeriodMs;

    if (isRevoked && !isWithinGracePeriod) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is inactive');
    }

    // Revoke old token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    // Fetch tenant name if tenantId exists
    let tenantName: string | null = null;
    if (stored.user.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: stored.user.tenantId },
        select: { name: true },
      });
      tenantName = tenant?.name || null;
    }

    // Fetch branch name if branchId exists
    let branchName: string | null = null;
    if (stored.user.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: stored.user.branchId },
        select: { name: true },
      });
      branchName = branch?.name || null;
    }

    // Generate new token pair
    const tokens = await this.generateTokens(stored.user);

    return {
      user: {
        id: stored.user.id,
        email: stored.user.email,
        firstName: stored.user.firstName,
        lastName: stored.user.lastName,
        role: stored.user.role,
        tenantId: stored.user.tenantId,
        tenantName,
        branchId: stored.user.branchId,
        branchName,
        preferredLanguage: stored.user.preferredLanguage,
      },
      ...tokens,
    };
  }

  /**
   * Revoke all refresh tokens for a user (logout).
   */
  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Request a password reset link by email.
   * Scoped to subdomain if tenant login, otherwise primary (Super Admin).
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const { email, subdomain } = dto;

    try {
      let user = null;

      if (subdomain) {
        // Scope search to this tenant subdomain
        const tenant = await this.prisma.tenant.findUnique({
          where: { subdomain },
        });

        if (tenant && tenant.status === 'ACTIVE') {
          // Find active user with this email in the tenant
          user = await this.prisma.user.findFirst({
            where: {
              email,
              tenantId: tenant.id,
              status: 'ACTIVE',
            },
          });
        }
      } else {
        // Primary domain: Search for active Super Admin
        user = await this.prisma.user.findFirst({
          where: {
            email,
            tenantId: null,
            role: UserRole.SUPER_ADMIN,
            status: 'ACTIVE',
          },
        });
      }

      // If user exists, generate token and send email
      if (user) {
        const resetToken = uuidv4();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 2); // 2 hours expiration

        await this.prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            token: resetToken,
            expiresAt,
          },
        });

        // Get tenant and subdomain information for building URLs
        let tenantName = 'DentalLab';
        let tenantSubdomain = subdomain || '';
        if (user.tenantId) {
          const tenant = await this.prisma.tenant.findUnique({
            where: { id: user.tenantId },
          });
          if (tenant) {
            tenantName = tenant.name;
            tenantSubdomain = tenant.subdomain;
          }
        }

        // Send email
        await this.mailService.sendForgotPassword(
          user.email,
          `${user.firstName} ${user.lastName}`,
          resetToken,
          tenantSubdomain,
          tenantName,
        );
      }
    } catch (err) {
      // Log error but don't expose it to client to avoid leaking info or errors
      this.logger.error(`Error in forgotPassword for ${email}: ${err.message}`, err.stack);
    }

    // Always return success to avoid user/account enumeration
    return { message: 'If this email is registered, we have sent a reset link.' };
  }

  /**
   * Validate password reset token.
   */
  async validateResetToken(token: string) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    return { valid: true };
  }

  /**
   * Reset user password using a valid reset token.
   */
  async resetPassword(dto: ResetPasswordDto) {
    const { token, newPassword } = dto;

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user password and set status to ACTIVE (if they were INVITED) for all accounts with this email/tenantId
    await this.prisma.user.updateMany({
      where: {
        email: resetToken.user.email,
        tenantId: resetToken.user.tenantId,
      },
      data: {
        passwordHash,
        status: 'ACTIVE',
      },
    });

    // Mark token as used
    await this.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    this.logger.log(`Password reset for user: ${resetToken.user.email}`);

    return { message: 'Password reset successfully' };
  }

  /**
   * Get current user profile.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        avatarUrl: true,
        tenantId: true,
        branchId: true,
        lastLoginAt: true,
        createdAt: true,
        preferredLanguage: true,
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            maxAdmins: true,
            maxTechnicians: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Get limits and current counts of users for a tenant.
   */
  async getTenantLimits(tenantId: string | null) {
    if (!tenantId) {
      return {
        maxAdmins: 0,
        currentAdmins: 0,
        maxTechnicians: 0,
        currentTechnicians: 0,
      };
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        maxAdmins: true,
        maxTechnicians: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const currentAdmins = await this.prisma.user.count({
      where: { tenantId, role: UserRole.ADMIN },
    });

    const currentTechnicians = await this.prisma.user.count({
      where: { tenantId, role: UserRole.TECHNICIAN },
    });

    return {
      maxAdmins: tenant.maxAdmins,
      currentAdmins,
      maxTechnicians: tenant.maxTechnicians,
      currentTechnicians,
    };
  }

  /**
   * Request a limit increase for the current tenant.
   */
  async requestLimitUpgrade(tenantId: string, userId: string, message: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const tenantName = tenant.name;
    const userName = user ? `${user.firstName} ${user.lastName}` : 'Owner';

    // 1. Log in Audit Logs
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        userEmail: user?.email || null,
        action: 'LIMITS_UPGRADE_REQUESTED',
        entityName: 'TENANT',
        entityId: tenantId,
        details: `Limits upgrade requested: ${message || 'No details provided'}`,
      },
    });

    // 2. Create system notification for all Super Admins
    const superAdmins = await this.prisma.user.findMany({
      where: { role: UserRole.SUPER_ADMIN },
      select: { id: true, preferredLanguage: true },
    });

    for (const admin of superAdmins) {
      const lang = admin.preferredLanguage || 'ES';
      const title =
        lang === 'ES'
          ? 'Solicitud de aumento de límite'
          : 'Limit Upgrade Request';
      const detailMessage =
        message ||
        (lang === 'ES'
          ? 'No se proporcionaron detalles'
          : 'No details provided');
      const finalMessage =
        lang === 'ES'
          ? `El propietario ${userName} (${tenantName}) solicitó un aumento de límite: ${detailMessage}`
          : `Owner ${userName} (${tenantName}) requested a limits upgrade: ${detailMessage}`;

      await this.prisma.notification.create({
        data: {
          tenantId,
          userId: admin.id,
          title,
          message: finalMessage,
          type: 'SYSTEM',
        },
      });
    }

    return { message: 'Upgrade request submitted successfully.' };
  }

  // ─── Private Helpers ──────────────────────────────────

  private async generateTokens(user: {
    id: string;
    email: string;
    role: string;
    tenantId: string | null;
    branchId: string | null;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      branchId: user.branchId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRY', '15m'),
      }),
      this.generateRefreshToken(user.id),
    ]);

    return { accessToken, refreshToken };
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = uuidv4();
    const expiresIn = this.configService.get('JWT_REFRESH_EXPIRY', '7d');
    const expiresAt = new Date();

    // Parse expiry (e.g., "7d" → 7 days)
    const match = expiresIn.match(/^(\d+)([dhms])$/);
    if (match) {
      const [, value, unit] = match;
      const multipliers: Record<string, number> = {
        d: 86400000,
        h: 3600000,
        m: 60000,
        s: 1000,
      };
      expiresAt.setTime(
        expiresAt.getTime() + parseInt(value) * multipliers[unit],
      );
    } else {
      expiresAt.setDate(expiresAt.getDate() + 7); // Default 7 days
    }

    await this.prisma.refreshToken.create({
      data: { userId, token, expiresAt },
    });

    return token;
  }

  /**
   * Update user's preferred language
   */
  async updateLanguage(userId: string, language: 'EN' | 'ES') {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, tenantId: true },
    });

    if (user && user.tenantId) {
      await this.prisma.user.updateMany({
        where: { email: user.email, tenantId: user.tenantId },
        data: { preferredLanguage: language },
      });
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { preferredLanguage: language },
      });
    }

    return { message: 'Language preference updated', language };
  }

  async getTenantInfoBySubdomain(subdomain: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
      select: { name: true, status: true, logoUrl: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }
}
