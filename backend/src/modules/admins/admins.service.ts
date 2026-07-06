import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateAdminDto, UpdateAdminDto } from './dto';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class AdminsService {
  private readonly logger = new Logger(AdminsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('email-queue') private readonly emailQueue: Queue,
  ) {}

  /**
   * Create (invite) a new branch admin.
   */
  async create(tenantId: string, dto: CreateAdminDto) {
    const { email, firstName, lastName, phone, branchId } = dto;

    // 1. Verify that the branch belongs to the tenant and get details
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });

    if (!branch) {
      throw new NotFoundException(
        `Branch with ID "${branchId}" does not exist in your organization.`,
      );
    }

    // Check user limits
    const currentAdminsCount = await this.prisma.user.count({
      where: { tenantId, role: UserRole.ADMIN },
    });

    // Load tenant name, subdomain, and limit details
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, subdomain: true, maxAdmins: true },
    });

    if (!tenant) {
      throw new NotFoundException('Organization not found.');
    }

    if (currentAdminsCount >= tenant.maxAdmins) {
      throw new BadRequestException(
        `Your organization has reached the limit of ${tenant.maxAdmins} Lab Administrator(s).`,
      );
    }

    // 2. Check if a user with this email already exists inside this tenant
    const existingUsers = await this.prisma.user.findMany({
      where: { email, tenantId },
    });

    let ownerUser = null;

    if (existingUsers.length > 0) {
      // If there is already an ADMIN, throw conflict
      const hasAdmin = existingUsers.some((u) => u.role === UserRole.ADMIN);
      if (hasAdmin) {
        throw new ConflictException(
          `A user with the email "${email}" already exists in your organization.`,
        );
      }

      // Check if there is an OWNER
      ownerUser = existingUsers.find((u) => u.role === UserRole.OWNER);
      if (ownerUser) {
        // Owner is allowed to be Admin. Make sure there are no other roles
        const hasOtherNonOwnerRoles = existingUsers.some(
          (u) => u.role !== UserRole.OWNER && u.role !== UserRole.ADMIN,
        );
        if (hasOtherNonOwnerRoles) {
          throw new ConflictException(
            `A user with the email "${email}" already exists in your organization with another role.`,
          );
        }
      } else {
        // If there's no owner but they already exist (e.g. as technician), throw conflict
        throw new ConflictException(
          `A user with the email "${email}" already exists in your organization.`,
        );
      }
    }

    // 3. Generate password hash for temporary password
    const tempPassword = uuidv4();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // 4. Create user and password reset token in a transaction
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const branchDetails = await tx.branch.findUnique({
          where: { id: branchId },
          select: { defaultAdminId: true },
        });

        const makeDefault = !branchDetails || !branchDetails.defaultAdminId;

        const admin = await tx.user.create({
          data: {
            tenantId,
            branchId,
            email,
            passwordHash: ownerUser ? ownerUser.passwordHash : passwordHash,
            firstName,
            lastName,
            phone: phone || null,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
          },
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        });

        if (makeDefault) {
          await tx.branch.update({
            where: { id: branchId },
            data: { defaultAdminId: admin.id },
          });
        }

        let resetToken = null;
        if (!ownerUser) {
          // Create password reset token (24h expiry)
          resetToken = uuidv4();
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 24);

          await tx.passwordResetToken.create({
            data: {
              userId: admin.id,
              token: resetToken,
              expiresAt,
            },
          });
        }

        return { admin, resetToken };
      });

      // 5. Send invitation email (non-blocking) only if not ownerUser
      if (result.resetToken) {
        try {
          await this.emailQueue.add('send-admin-invite', {
            email,
            adminName: `${firstName} ${lastName}`,
            tenantName: tenant.name,
            branchName: branch.name,
            resetToken: result.resetToken,
            subdomain: tenant.subdomain,
          });
        } catch (emailError) {
          this.logger.warn(
            `Failed to queue invitation email for ${email}: ${emailError.message}`,
          );
          // Don't fail the entire operation if email queueing fails
        }
      }

      this.logger.log(
        `Admin created: ${email} for branch ${branch.name} inside tenant ${tenantId}`,
      );

      // Exclude passwordHash from response
      const { passwordHash: _, ...adminWithoutPassword } = result.admin;

      return {
        ...adminWithoutPassword,
        isOwnerAdmin: !!ownerUser,
      };
    } catch (error) {
      // Handle Prisma unique constraint violation
      if (error?.code === 'P2002') {
        throw new ConflictException(
          `A Lab Admin with the email "${email}" already exists in your organization.`,
        );
      }
      throw error;
    }
  }

  /**
   * List all admins in the owner's organization.
   */
  async findAll(tenantId: string, branchId?: string) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        role: UserRole.ADMIN,
        ...(branchId && { branchId }),
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultAdminId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find details of a specific admin.
   */
  async findOne(tenantId: string, id: string) {
    const admin = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
        role: UserRole.ADMIN,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultAdminId: true,
          },
        },
      },
    });

    if (!admin) {
      throw new NotFoundException(`Admin with ID "${id}" not found.`);
    }

    return admin;
  }

  /**
   * Update admin details (first name, last name, phone, branch, status).
   */
  async update(tenantId: string, id: string, dto: UpdateAdminDto) {
    // 1. Verify admin exists
    const currentAdmin = await this.findOne(tenantId, id);

    const { firstName, lastName, phone, branchId, status } = dto;

    // 2. If branch is updated, verify it belongs to this tenant
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, tenantId },
      });

      if (!branch) {
        throw new NotFoundException(
          `Branch with ID "${branchId}" does not exist in your organization.`,
        );
      }
    }

    // 3. Validations for Default Admin status
    const isDefaultAdmin =
      currentAdmin.branch?.defaultAdminId === currentAdmin.id;
    if (isDefaultAdmin) {
      // If deactivating default admin
      if (status && status !== UserStatus.ACTIVE) {
        const otherActiveAdminsCount = await this.prisma.user.count({
          where: {
            branchId: currentAdmin.branchId,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            id: { not: currentAdmin.id },
          },
        });
        if (otherActiveAdminsCount > 0) {
          throw new BadRequestException(
            'Cannot deactivate the default admin. Please designate another active administrator as the default admin first.',
          );
        } else if (currentAdmin.branchId) {
          await this.prisma.branch.update({
            where: { id: currentAdmin.branchId },
            data: { defaultAdminId: null },
          });
        }
      }

      // If changing branch of default admin
      if (branchId && branchId !== currentAdmin.branchId) {
        const otherActiveAdminsCount = await this.prisma.user.count({
          where: {
            branchId: currentAdmin.branchId,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            id: { not: currentAdmin.id },
          },
        });
        if (otherActiveAdminsCount > 0) {
          throw new BadRequestException(
            'Cannot change the branch of the default admin. Please designate another active administrator as the default admin in the current branch first.',
          );
        } else if (currentAdmin.branchId) {
          await this.prisma.branch.update({
            where: { id: currentAdmin.branchId },
            data: { defaultAdminId: null },
          });
        }
      }
    }

    // 3b. Automatic default admin assignment for the new branch if it does not have one
    if (branchId && branchId !== currentAdmin.branchId) {
      const newBranch = await this.prisma.branch.findUnique({
        where: { id: branchId },
        select: { defaultAdminId: true },
      });
      if (newBranch && !newBranch.defaultAdminId) {
        await this.prisma.branch.update({
          where: { id: branchId },
          data: { defaultAdminId: id },
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(branchId && { branchId }),
        ...(status && { status }),
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultAdminId: true,
          },
        },
      },
    });

    this.logger.log(`Admin updated: ${updated.email} (${updated.id})`);
    return updated;
  }

  /**
   * Delete an admin user.
   */
  async remove(tenantId: string, id: string) {
    // Verify admin exists
    const admin = await this.findOne(tenantId, id);

    if (admin.branch?.defaultAdminId === admin.id) {
      const otherAdminsCount = await this.prisma.user.count({
        where: {
          branchId: admin.branchId,
          role: UserRole.ADMIN,
          id: { not: admin.id },
        },
      });
      if (otherAdminsCount > 0) {
        throw new BadRequestException(
          'Cannot delete the default admin. Please designate another active administrator as the default admin first.',
        );
      }
    }

    await this.prisma.user.delete({
      where: { id },
    });

    this.logger.log(`Admin deleted: ${id} in tenant ${tenantId}`);
    return { success: true };
  }
}
