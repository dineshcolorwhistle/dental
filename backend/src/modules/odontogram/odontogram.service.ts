import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TeethModel, UserRole } from '@prisma/client';
import {
  UpdateOdontogramConfigDto,
  CreateOdontogramTreatmentDto,
  UpdateOdontogramTreatmentDto,
  CreateOdontogramDiagnosticDto,
  UpdateOdontogramDiagnosticDto,
} from './dto';

@Injectable()
export class OdontogramService {
  private readonly logger = new Logger(OdontogramService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve tenant ID for operations, especially when Super Admin accesses endpoints
   */
  async resolveTenantId(
    tenantId: string | undefined,
    userRole: string,
  ): Promise<string> {
    if (tenantId) return tenantId;

    if (userRole === UserRole.SUPER_ADMIN) {
      const firstTenant = await this.prisma.tenant.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (firstTenant) return firstTenant.id;
    }

    throw new BadRequestException('Organization context is required.');
  }

  // ─── Config / Default Teeth Model ────────────────────────

  async getConfig(tenantId: string, branchId?: string) {
    if (branchId && branchId !== 'ALL') {
      const branchConfig = await this.prisma.odontogramConfig.findFirst({
        where: { tenantId, branchId },
      });
      if (branchConfig) return branchConfig;
    }

    // Fallback to tenant-level config
    const tenantConfig = await this.prisma.odontogramConfig.findFirst({
      where: { tenantId, branchId: null },
    });

    if (tenantConfig) return tenantConfig;

    // Default response if no config was created yet
    return {
      tenantId,
      branchId: branchId && branchId !== 'ALL' ? branchId : null,
      defaultTeethModel: TeethModel.ADULT,
    };
  }

  async updateConfig(
    tenantId: string,
    branchIdContext: string | null,
    userRole: string,
    dto: UpdateOdontogramConfigDto,
  ) {
    let targetBranchId: string | null = dto.branchId || null;

    if (userRole === UserRole.ADMIN) {
      if (!branchIdContext) {
        throw new BadRequestException(
          'Branch context is required for Lab Admin.',
        );
      }
      targetBranchId = branchIdContext;
    }

    if (targetBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: targetBranchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundException(
          `Branch with ID "${targetBranchId}" does not exist in your organization.`,
        );
      }
    }

    // Upsert configuration for tenant + branch
    const existing = await this.prisma.odontogramConfig.findFirst({
      where: {
        tenantId,
        branchId: targetBranchId,
      },
    });

    if (existing) {
      return this.prisma.odontogramConfig.update({
        where: { id: existing.id },
        data: {
          defaultTeethModel: dto.defaultTeethModel,
        },
      });
    }

    return this.prisma.odontogramConfig.create({
      data: {
        tenantId,
        branchId: targetBranchId,
        defaultTeethModel: dto.defaultTeethModel,
      },
    });
  }

  // ─── Treatments ──────────────────────────────────────────

  async findAllTreatments(tenantId: string, branchIdFilter?: string) {
    return this.prisma.odontogramTreatment.findMany({
      where: {
        tenantId,
        ...(branchIdFilter &&
          branchIdFilter !== 'ALL' && { branchId: branchIdFilter }),
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createTreatment(
    tenantId: string,
    branchIdContext: string | null,
    userRole: string,
    dto: CreateOdontogramTreatmentDto,
  ) {
    let finalBranchId = dto.branchId;

    if (userRole === UserRole.ADMIN) {
      if (!branchIdContext) {
        throw new BadRequestException(
          'Branch context is required for Lab Admin.',
        );
      }
      finalBranchId = branchIdContext;
    }

    if (!finalBranchId) {
      throw new BadRequestException(
        'Branch context is required to create a branch-scoped treatment.',
      );
    }

    // Verify branch belongs to tenant
    const branch = await this.prisma.branch.findFirst({
      where: { id: finalBranchId, tenantId },
    });
    if (!branch) {
      throw new NotFoundException(
        `Branch with ID "${finalBranchId}" does not exist in your organization.`,
      );
    }

    // Check for duplicate name in same branch
    const existing = await this.prisma.odontogramTreatment.findFirst({
      where: {
        tenantId,
        branchId: finalBranchId,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A treatment named "${dto.name}" already exists for this branch.`,
      );
    }

    return this.prisma.odontogramTreatment.create({
      data: {
        tenantId,
        branchId: finalBranchId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        color: dto.color,
        appliesToWholeTooth: dto.appliesToWholeTooth ?? false,
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async updateTreatment(
    tenantId: string,
    id: string,
    branchIdContext: string | null,
    userRole: string,
    dto: UpdateOdontogramTreatmentDto,
  ) {
    const treatment = await this.prisma.odontogramTreatment.findFirst({
      where: { id, tenantId },
    });

    if (!treatment) {
      throw new NotFoundException(`Treatment with ID "${id}" was not found.`);
    }

    if (
      userRole === UserRole.ADMIN &&
      branchIdContext &&
      treatment.branchId !== branchIdContext
    ) {
      throw new BadRequestException(
        'You do not have permission to modify a treatment outside your branch.',
      );
    }

    // If name is changing, check for duplicates in the same branch
    if (dto.name && dto.name.trim() !== treatment.name) {
      const duplicate = await this.prisma.odontogramTreatment.findFirst({
        where: {
          tenantId,
          branchId: treatment.branchId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `A treatment named "${dto.name}" already exists for this branch.`,
        );
      }
    }

    return this.prisma.odontogramTreatment.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim(),
        }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.appliesToWholeTooth !== undefined && {
          appliesToWholeTooth: dto.appliesToWholeTooth,
        }),
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async removeTreatment(tenantId: string, id: string) {
    const treatment = await this.prisma.odontogramTreatment.findFirst({
      where: { id, tenantId },
    });

    if (!treatment) {
      throw new NotFoundException(`Treatment with ID "${id}" was not found.`);
    }

    await this.prisma.odontogramTreatment.delete({
      where: { id },
    });

    return { success: true, message: 'Treatment deleted successfully' };
  }

  // ─── Diagnostics ─────────────────────────────────────────

  async findAllDiagnostics(tenantId: string, branchIdFilter?: string) {
    return this.prisma.odontogramDiagnostic.findMany({
      where: {
        tenantId,
        ...(branchIdFilter &&
          branchIdFilter !== 'ALL' && { branchId: branchIdFilter }),
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createDiagnostic(
    tenantId: string,
    branchIdContext: string | null,
    userRole: string,
    dto: CreateOdontogramDiagnosticDto,
  ) {
    let finalBranchId = dto.branchId;

    if (userRole === UserRole.ADMIN) {
      if (!branchIdContext) {
        throw new BadRequestException(
          'Branch context is required for Lab Admin.',
        );
      }
      finalBranchId = branchIdContext;
    }

    if (!finalBranchId) {
      throw new BadRequestException(
        'Branch context is required to create a branch-scoped diagnostic.',
      );
    }

    // Verify branch belongs to tenant
    const branch = await this.prisma.branch.findFirst({
      where: { id: finalBranchId, tenantId },
    });
    if (!branch) {
      throw new NotFoundException(
        `Branch with ID "${finalBranchId}" does not exist in your organization.`,
      );
    }

    // Check for duplicate name in same branch
    const existing = await this.prisma.odontogramDiagnostic.findFirst({
      where: {
        tenantId,
        branchId: finalBranchId,
        name: { equals: dto.name.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A diagnostic entry named "${dto.name}" already exists for this branch.`,
      );
    }

    return this.prisma.odontogramDiagnostic.create({
      data: {
        tenantId,
        branchId: finalBranchId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        color: dto.color,
        appliesToWholeTooth: dto.appliesToWholeTooth ?? false,
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async updateDiagnostic(
    tenantId: string,
    id: string,
    branchIdContext: string | null,
    userRole: string,
    dto: UpdateOdontogramDiagnosticDto,
  ) {
    const diagnostic = await this.prisma.odontogramDiagnostic.findFirst({
      where: { id, tenantId },
    });

    if (!diagnostic) {
      throw new NotFoundException(`Diagnostic with ID "${id}" was not found.`);
    }

    if (
      userRole === UserRole.ADMIN &&
      branchIdContext &&
      diagnostic.branchId !== branchIdContext
    ) {
      throw new BadRequestException(
        'You do not have permission to modify a diagnostic outside your branch.',
      );
    }

    // If name is changing, check for duplicates in the same branch
    if (dto.name && dto.name.trim() !== diagnostic.name) {
      const duplicate = await this.prisma.odontogramDiagnostic.findFirst({
        where: {
          tenantId,
          branchId: diagnostic.branchId,
          name: { equals: dto.name.trim(), mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `A diagnostic entry named "${dto.name}" already exists for this branch.`,
        );
      }
    }

    return this.prisma.odontogramDiagnostic.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim(),
        }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.appliesToWholeTooth !== undefined && {
          appliesToWholeTooth: dto.appliesToWholeTooth,
        }),
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async removeDiagnostic(tenantId: string, id: string) {
    const diagnostic = await this.prisma.odontogramDiagnostic.findFirst({
      where: { id, tenantId },
    });

    if (!diagnostic) {
      throw new NotFoundException(`Diagnostic with ID "${id}" was not found.`);
    }

    await this.prisma.odontogramDiagnostic.delete({
      where: { id },
    });

    return { success: true, message: 'Diagnostic deleted successfully' };
  }
}

