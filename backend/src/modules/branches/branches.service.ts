import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new branch within the owner's tenant.
   */
  async create(tenantId: string, dto: CreateBranchDto) {
    const { name, address, phone, email, isActive } = dto;

    // Generate branch code if not provided
    const code = dto.code
      ? dto.code.toUpperCase().replace(/[^A-Z0-9]/g, '')
      : this.generateBranchCode(name);

    // Check code uniqueness within the tenant
    const existingBranch = await this.prisma.branch.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code,
        },
      },
    });

    if (existingBranch) {
      throw new ConflictException(
        `A branch with code "${code}" already exists in your organization.`,
      );
    }

    const branch = await this.prisma.branch.create({
      data: {
        tenantId,
        name,
        code,
        address,
        phone,
        email,
        isActive: isActive ?? true,
      },
    });

    this.logger.log(`Branch created: ${name} (${code}) in tenant ${tenantId}`);
    return branch;
  }

  /**
   * List all branches within the owner's tenant with user counts.
   */
  async findAll(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId },
      include: {
        defaultAdmin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find a single branch in the tenant.
   */
  async findOne(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId },
      include: {
        defaultAdmin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException(
        `Branch not found or you do not have permission.`,
      );
    }

    return branch;
  }

  /**
   * Update a branch's details.
   */
  async update(tenantId: string, id: string, dto: UpdateBranchDto) {
    // Verify branch exists and belongs to the tenant
    await this.findOne(tenantId, id);

    const { name, address, phone, email, isActive, defaultAdminId } = dto;
    let code: string | undefined;

    if (dto.code) {
      code = dto.code.toUpperCase().replace(/[^A-Z0-9]/g, '');

      // Check if another branch is already using this code
      const duplicateBranch = await this.prisma.branch.findFirst({
        where: {
          tenantId,
          code,
          id: { not: id },
        },
      });

      if (duplicateBranch) {
        throw new ConflictException(
          `A branch with code "${code}" already exists in your organization.`,
        );
      }
    }

    if (defaultAdminId !== undefined) {
      if (defaultAdminId === null) {
        const activeAdminsCount = await this.prisma.user.count({
          where: {
            branchId: id,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
          },
        });
        if (activeAdminsCount > 0) {
          throw new BadRequestException(
            'Cannot remove the Default Admin when there are active administrators in the branch.',
          );
        }
      } else {
        const user = await this.prisma.user.findFirst({
          where: { id: defaultAdminId, tenantId },
        });

        if (!user) {
          throw new NotFoundException(
            `User with ID "${defaultAdminId}" not found in your organization.`,
          );
        }

        if (user.role !== UserRole.ADMIN) {
          throw new BadRequestException(
            'The designated Default Admin must have the ADMIN role.',
          );
        }

        if (user.branchId !== id) {
          throw new BadRequestException(
            'The designated Default Admin must belong to this branch.',
          );
        }

        if (user.status !== UserStatus.ACTIVE) {
          throw new BadRequestException(
            'The designated Default Admin must be active.',
          );
        }
      }
    }

    const updatedBranch = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(isActive !== undefined && { isActive }),
        ...(defaultAdminId !== undefined && { defaultAdminId }),
      },
    });

    this.logger.log(
      `Branch updated: ${updatedBranch.name} (${updatedBranch.id})`,
    );
    return updatedBranch;
  }

  /**
   * Delete a branch.
   */
  async remove(tenantId: string, id: string) {
    // Verify branch exists and belongs to the tenant
    await this.findOne(tenantId, id);

    // Delete the branch (Prisma automatically handles users.branchId -> set null based on onDelete: SetNull)
    await this.prisma.branch.delete({
      where: { id },
    });

    this.logger.log(`Branch deleted: ${id} in tenant ${tenantId}`);
    return { success: true };
  }

  // ─── Private Helpers ──────────────────────────────────

  /**
   * Generate branch code from branch name.
   */
  private generateBranchCode(name: string): string {
    const code = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
    return code || 'BRANCH';
  }
}
