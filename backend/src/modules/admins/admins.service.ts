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
import { MailService } from '../mail/mail.service';
import { CreateAdminDto, UpdateAdminDto } from './dto';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class AdminsService {
  private readonly logger = new Logger(AdminsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
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

    // Load tenant name and subdomain
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, subdomain: true },
    });

    if (!tenant) {
      throw new NotFoundException('Organization not found.');
    }

    // 2. Check if a user with this email already exists inside this tenant
    const existingUser = await this.prisma.user.findFirst({
      where: { email, tenantId },
    });

    if (existingUser) {
      throw new ConflictException(
        `A user with the email "${email}" already exists in your organization.`,
      );
    }

    // 3. Generate password hash for temporary password
    const tempPassword = uuidv4();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // 4. Create user and password reset token in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const admin = await tx.user.create({
        data: {
          tenantId,
          branchId,
          email,
          passwordHash,
          firstName,
          lastName,
          phone,
          role: UserRole.ADMIN,
          status: UserStatus.INVITED,
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

      // Create password reset token (24h expiry)
      const resetToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await tx.passwordResetToken.create({
        data: {
          userId: admin.id,
          token: resetToken,
          expiresAt,
        },
      });

      return { admin, resetToken };
    });

    // 5. Send invitation email (non-blocking)
    await this.mailService.sendAdminInvite(
      email,
      `${firstName} ${lastName}`,
      tenant.name,
      branch.name,
      result.resetToken,
      tenant.subdomain,
    );

    this.logger.log(
      `Admin created: ${email} for branch ${branch.name} inside tenant ${tenantId}`,
    );

    return result.admin;
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
    await this.findOne(tenantId, id);

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
    await this.findOne(tenantId, id);

    await this.prisma.user.delete({
      where: { id },
    });

    this.logger.log(`Admin deleted: ${id} in tenant ${tenantId}`);
    return { success: true };
  }
}
