import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateTenantDto, UpdateTenantDto } from './dto';
import { TenantStatus, UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create a new tenant with owner, default branch, settings, and send invite email.
   */
  async create(dto: CreateTenantDto) {
    const { tenantName, ownerName, ownerEmail } = dto;

    // Generate subdomain from tenant name (slugify)
    const subdomain = this.generateSubdomain(tenantName);

    // Check if subdomain already exists
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
    });

    if (existingTenant) {
      throw new ConflictException(
        `A tenant with the subdomain "${subdomain}" already exists. Please choose a different name.`,
      );
    }

    // Check if owner email already exists for any tenant
    const existingOwner = await this.prisma.user.findFirst({
      where: { email: ownerEmail, role: UserRole.OWNER },
    });

    if (existingOwner) {
      throw new ConflictException(
        `An owner with the email "${ownerEmail}" already exists.`,
      );
    }

    // Parse owner name into first/last
    const { firstName, lastName } = this.parseFullName(ownerName);

    // Generate a random temporary password (will be reset via email)
    const tempPassword = uuidv4();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Create everything in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          subdomain,
          status: TenantStatus.ACTIVE,
          contactEmail: ownerEmail,
        },
      });

      // 2. Create Owner user
      const owner = await tx.user.create({
        data: {
          tenantId: tenant.id,
          branchId: null,
          email: ownerEmail,
          passwordHash,
          firstName,
          lastName,
          role: UserRole.OWNER,
          status: UserStatus.INVITED,
        },
      });

      // 3. Create Tenant Settings with defaults
      await tx.tenantSettings.create({
        data: {
          tenantId: tenant.id,
          features: {
            qrWorkflow: true,
            deliveryModule: true,
            doctorPortal: false,
          },
        },
      });

      // 4. Create password reset token (24h expiry)
      const resetToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await tx.passwordResetToken.create({
        data: {
          userId: owner.id,
          token: resetToken,
          expiresAt,
        },
      });

      return { tenant, owner, resetToken };
    });

    // 5. Send invite email (outside transaction — non-blocking)
    await this.mailService.sendOwnerInvite(
      ownerEmail,
      `${firstName} ${lastName}`,
      tenantName,
      result.resetToken,
      subdomain,
    );

    this.logger.log(
      `Tenant created: ${tenantName} (${subdomain}) with owner ${ownerEmail}`,
    );

    return {
      id: result.tenant.id,
      name: result.tenant.name,
      subdomain: result.tenant.subdomain,
      status: result.tenant.status,
      owner: {
        id: result.owner.id,
        email: result.owner.email,
        firstName: result.owner.firstName,
        lastName: result.owner.lastName,
      },
      branch: null,
      createdAt: result.tenant.createdAt,
    };
  }

  /**
   * List all tenants with counts.
   */
  async findAll() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            branches: true,
            users: true,
          },
        },
        users: {
          where: { role: UserRole.OWNER },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
          },
          take: 1,
        },
        branches: {
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
        settings: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      status: tenant.status,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      branchCount: tenant._count.branches,
      userCount: tenant._count.users,
      owner: tenant.users[0] ?? null,
      primaryBranch: tenant.branches[0] ?? null,
      settings: tenant.settings,
    }));
  }

  /**
   * Get single tenant with full details.
   */
  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        branches: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
            createdAt: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
        settings: true,
        _count: {
          select: {
            branches: true,
            users: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    return tenant;
  }

  /**
   * Update tenant details.
   */
  async update(id: string, dto: UpdateTenantDto) {
    const { settings, ...tenantData } = dto;
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...tenantData,
        ...(settings && {
          settings: {
            update: {
              ...(settings.features && { features: settings.features }),
            },
          },
        }),
      },
      include: {
        settings: true,
      },
    });

    this.logger.log(`Tenant updated: ${updated.name} (${updated.id})`);

    return updated;
  }

  /**
   * Update tenant status (activate/deactivate/suspend).
   */
  async updateStatus(id: string, status: TenantStatus) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { status },
    });

    this.logger.log(`Tenant status updated: ${updated.name} → ${status}`);

    return updated;
  }

  /**
   * Delete a tenant.
   */
  async remove(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    await this.prisma.tenant.delete({ where: { id } });

    this.logger.log(`Tenant deleted: ${tenant.name} (${id})`);

    return { success: true };
  }

  // ─── Private Helpers ──────────────────────────────────

  /**
   * Generate URL-safe subdomain from tenant name.
   * "Smile Dental Lab" → "smile-dental-lab"
   */
  private generateSubdomain(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Parse a full name string into first and last name.
   */
  private parseFullName(fullName: string): {
    firstName: string;
    lastName: string;
  } {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] || 'Owner';
    const lastName = parts.slice(1).join(' ') || '';
    return { firstName, lastName };
  }

  /**
   * Generate branch code from branch name.
   * "Main Branch" → "MAIN"
   */
  private generateBranchCode(name: string): string {
    const code = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
    return code || 'MAIN';
  }
}
