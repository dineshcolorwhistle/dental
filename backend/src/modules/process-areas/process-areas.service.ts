import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProcessAreaDto, UpdateProcessAreaDto } from './dto';

@Injectable()
export class ProcessAreasService {
  private readonly logger = new Logger(ProcessAreasService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    branchIdContext: string | null,
    userRole: string,
    dto: CreateProcessAreaDto,
  ) {
    const { name, description, branchId } = dto;

    // Force branch for Administrators
    let finalBranchId = branchId;
    if (userRole === 'ADMIN') {
      if (!branchIdContext) {
        throw new BadRequestException(
          'Branch context is required for administrators.',
        );
      }
      finalBranchId = branchIdContext;
    }

    if (!finalBranchId) {
      throw new BadRequestException(
        'Branch context is required to create a branch-scoped process area.',
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
    const existing = await this.prisma.processArea.findFirst({
      where: {
        tenantId,
        branchId: finalBranchId,
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A Process Area with the name "${name}" already exists in this branch.`,
      );
    }

    const processArea = await this.prisma.processArea.create({
      data: {
        tenantId,
        branchId: finalBranchId,
        name,
        description,
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    this.logger.log(
      `Process Area created: ${processArea.name} (${processArea.id}) for tenant ${tenantId}`,
    );
    return processArea;
  }

  async findAll(tenantId: string, branchIdFilter?: string) {
    return this.prisma.processArea.findMany({
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

  async findOne(tenantId: string, id: string, branchIdContext?: string | null) {
    const processArea = await this.prisma.processArea.findFirst({
      where: {
        id,
        tenantId,
        ...(branchIdContext && { branchId: branchIdContext }),
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!processArea) {
      throw new NotFoundException(`Process Area with ID "${id}" not found.`);
    }

    return processArea;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateProcessAreaDto,
    branchIdContext?: string | null,
  ) {
    const existing = await this.findOne(tenantId, id, branchIdContext);

    const { name, description, branchId } = dto;

    const finalBranchId =
      branchId !== undefined ? branchId : existing.branchId;

    if (finalBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: finalBranchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundException(
          `Branch with ID "${finalBranchId}" does not exist in your organization.`,
        );
      }
    }

    if (name && name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.processArea.findFirst({
        where: {
          tenantId,
          branchId: finalBranchId || null,
          name: { equals: name, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `A Process Area with the name "${name}" already exists in this branch.`,
        );
      }
    }

    const updated = await this.prisma.processArea.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(branchId !== undefined && { branchId: finalBranchId || null }),
      },
      include: {
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    this.logger.log(`Process Area updated: ${updated.name} (${updated.id})`);
    return updated;
  }

  async remove(tenantId: string, id: string, branchIdContext?: string | null) {
    await this.findOne(tenantId, id, branchIdContext);

    // Check if any process is using this process area
    const inUse = await this.prisma.process.findFirst({
      where: { processAreaId: id },
    });

    if (inUse) {
      throw new BadRequestException(
        'Cannot delete Process Area because it is currently linked to processes.',
      );
    }

    await this.prisma.processArea.delete({
      where: { id },
    });

    this.logger.log(`Process Area deleted: ${id} inside tenant ${tenantId}`);
    return { success: true };
  }
}
