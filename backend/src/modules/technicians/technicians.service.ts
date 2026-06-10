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
import { CreateTechnicianDto, UpdateTechnicianDto } from './dto';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class TechniciansService {
  private readonly logger = new Logger(TechniciansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Create (invite) a new technician user.
   */
  async create(
    tenantId: string,
    branchIdContext: string | null,
    userRole: string,
    dto: CreateTechnicianDto,
  ) {
    const { email, firstName, lastName, phone, branchId } = dto;

    // If logged in as ADMIN, force their branch context
    let finalBranchId = branchId;
    if (userRole === 'ADMIN') {
      if (!branchIdContext) {
        throw new BadRequestException(
          'Branch context is required for administrators.',
        );
      }
      finalBranchId = branchIdContext;
    }

    // 1. Verify that the branch belongs to the tenant and get details
    const branch = await this.prisma.branch.findFirst({
      where: { id: finalBranchId, tenantId },
    });

    if (!branch) {
      throw new NotFoundException(
        `Branch with ID "${finalBranchId}" does not exist in your organization.`,
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
      const technician = await tx.user.create({
        data: {
          tenantId,
          branchId: finalBranchId,
          email,
          passwordHash,
          firstName,
          lastName,
          phone,
          role: UserRole.TECHNICIAN,
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
          userId: technician.id,
          token: resetToken,
          expiresAt,
        },
      });

      return { technician, resetToken };
    });

    // 5. Send invitation email (non-blocking)
    await this.mailService.sendTechnicianInvite(
      email,
      `${firstName} ${lastName}`,
      tenant.name,
      branch.name,
      result.resetToken,
      tenant.subdomain,
    );

    this.logger.log(
      `Technician created: ${email} for branch ${branch.name} inside tenant ${tenantId}`,
    );

    return result.technician;
  }

  /**
   * List all technicians in the organization or filtered by branch.
   */
  async findAll(tenantId: string, branchIdFilter?: string) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        role: UserRole.TECHNICIAN,
        ...(branchIdFilter &&
          branchIdFilter !== 'ALL' && { branchId: branchIdFilter }),
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
   * Find details of a specific technician.
   */
  async findOne(tenantId: string, id: string, branchIdContext?: string | null) {
    const technician = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
        role: UserRole.TECHNICIAN,
        ...(branchIdContext && { branchId: branchIdContext }),
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

    if (!technician) {
      throw new NotFoundException(`Technician with ID "${id}" not found.`);
    }

    return technician;
  }

  /**
   * Update technician details.
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateTechnicianDto,
    branchIdContext?: string | null,
  ) {
    // 1. Verify technician exists
    await this.findOne(tenantId, id, branchIdContext);

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

    this.logger.log(`Technician updated: ${updated.email} (${updated.id})`);
    return updated;
  }

  /**
   * Delete a technician user.
   */
  async remove(tenantId: string, id: string, branchIdContext?: string | null) {
    // Verify technician exists
    await this.findOne(tenantId, id, branchIdContext);

    await this.prisma.user.delete({
      where: { id },
    });

    this.logger.log(`Technician deleted: ${id} in tenant ${tenantId}`);
    return { success: true };
  }
}
