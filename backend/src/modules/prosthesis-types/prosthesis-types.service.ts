import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProsthesisTypeDto, UpdateProsthesisTypeDto } from './dto';

@Injectable()
export class ProsthesisTypesService {
  private readonly logger = new Logger(ProsthesisTypesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Standard includes for returning full prosthesis type data
  private readonly fullInclude = {
    branch: {
      select: { id: true, name: true },
    },
    processAssignments: {
      orderBy: { sequence: 'asc' as const },
      include: {
        process: {
          include: {
            defaultTechnician: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            branch: {
              select: { id: true, name: true },
            },
          },
        },
      },
    },
  };

  async create(tenantId: string, branchIdContext: string | null, userRole: string, dto: CreateProsthesisTypeDto) {
    const { name, description, branchId, processIds } = dto;

    // Force branch for Administrators
    let finalBranchId = branchId;
    if (userRole === 'ADMIN') {
      if (!branchIdContext) {
        throw new BadRequestException('Branch context is required for administrators.');
      }
      finalBranchId = branchIdContext;
    }

    // Verify branch belongs to tenant if provided
    if (finalBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: finalBranchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundException(`Branch with ID "${finalBranchId}" does not exist in your organization.`);
      }
    }

    // Check for duplicate name in the same tenant + branch
    const existing = await this.prisma.prosthesisType.findFirst({
      where: {
        tenantId,
        branchId: finalBranchId || null,
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(`A prosthesis type with the name "${name}" already exists.`);
    }

    // Verify all processIds belong to the same tenant if provided
    if (processIds && processIds.length > 0) {
      const validProcesses = await this.prisma.process.findMany({
        where: { id: { in: processIds }, tenantId },
        select: { id: true },
      });
      const validIds = new Set(validProcesses.map((p) => p.id));
      const invalidIds = processIds.filter((id) => !validIds.has(id));
      if (invalidIds.length > 0) {
        throw new NotFoundException(`Process(es) not found: ${invalidIds.join(', ')}`);
      }
    }

    const type = await this.prisma.prosthesisType.create({
      data: {
        tenantId,
        branchId: finalBranchId || null,
        name,
        description,
        ...(processIds && processIds.length > 0 && {
          processAssignments: {
            create: processIds.map((processId, index) => ({
              processId,
              sequence: index,
            })),
          },
        }),
      },
      include: this.fullInclude,
    });

    this.logger.log(`Prosthesis type created: ${type.name} (${type.id}) for tenant ${tenantId}`);
    return type;
  }

  async findAll(tenantId: string, branchIdFilter?: string) {
    return this.prisma.prosthesisType.findMany({
      where: {
        tenantId,
        ...(branchIdFilter && branchIdFilter !== 'ALL' && { branchId: branchIdFilter }),
      },
      include: this.fullInclude,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string, branchIdContext?: string | null) {
    const type = await this.prisma.prosthesisType.findFirst({
      where: {
        id,
        tenantId,
        ...(branchIdContext && { branchId: branchIdContext }),
      },
      include: this.fullInclude,
    });

    if (!type) {
      throw new NotFoundException(`Prosthesis type with ID "${id}" not found.`);
    }

    return type;
  }

  async update(tenantId: string, id: string, dto: UpdateProsthesisTypeDto, branchIdContext?: string | null) {
    // Verify existence
    await this.findOne(tenantId, id, branchIdContext);

    const { name, description, processIds } = dto;

    if (name) {
      const existingType = await this.prisma.prosthesisType.findFirst({
        where: { id, tenantId },
        select: { branchId: true },
      });

      const existing = await this.prisma.prosthesisType.findFirst({
        where: {
          tenantId,
          branchId: existingType?.branchId || null,
          name: { equals: name, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(`A prosthesis type with the name "${name}" already exists.`);
      }
    }

    // Verify all processIds belong to the same tenant if provided
    if (processIds && processIds.length > 0) {
      const validProcesses = await this.prisma.process.findMany({
        where: { id: { in: processIds }, tenantId },
        select: { id: true },
      });
      const validIds = new Set(validProcesses.map((p) => p.id));
      const invalidIds = processIds.filter((pid) => !validIds.has(pid));
      if (invalidIds.length > 0) {
        throw new NotFoundException(`Process(es) not found: ${invalidIds.join(', ')}`);
      }
    }

    // Build update data
    const updateData: any = {
      ...(name && { name }),
      ...(description !== undefined && { description }),
    };

    // If processIds is provided, replace the junction records
    if (processIds !== undefined) {
      updateData.processAssignments = {
        deleteMany: {},
        create: (processIds || []).map((processId, index) => ({
          processId,
          sequence: index,
        })),
      };
    }

    const updated = await this.prisma.prosthesisType.update({
      where: { id },
      data: updateData,
      include: this.fullInclude,
    });

    this.logger.log(`Prosthesis type updated: ${updated.name} (${updated.id})`);
    return updated;
  }

  async remove(tenantId: string, id: string, branchIdContext?: string | null) {
    await this.findOne(tenantId, id, branchIdContext);

    await this.prisma.prosthesisType.delete({
      where: { id },
    });

    this.logger.log(`Prosthesis type deleted: ${id} inside tenant ${tenantId}`);
    return { success: true };
  }

  async reorderProcesses(tenantId: string, prosthesisTypeId: string, processIds: string[]) {
    // Verify prosthesis type belongs to tenant
    const prosthesisType = await this.prisma.prosthesisType.findFirst({
      where: { id: prosthesisTypeId, tenantId },
    });
    if (!prosthesisType) {
      throw new NotFoundException(`Prosthesis type with ID "${prosthesisTypeId}" not found.`);
    }

    // Update sequences inside a transaction — delete existing and re-create with new order
    await this.prisma.$transaction(async (tx) => {
      await tx.prosthesisTypeProcess.deleteMany({
        where: { prosthesisTypeId },
      });

      await tx.prosthesisTypeProcess.createMany({
        data: processIds.map((processId, index) => ({
          prosthesisTypeId,
          processId,
          sequence: index,
        })),
      });
    });

    this.logger.log(`Processes reordered for prosthesis type: ${prosthesisTypeId}`);
    return { success: true };
  }

  async getProcesses(tenantId: string, prosthesisTypeId: string) {
    // Verify prosthesis type belongs to tenant
    const prosthesisType = await this.prisma.prosthesisType.findFirst({
      where: { id: prosthesisTypeId, tenantId },
    });
    if (!prosthesisType) {
      throw new NotFoundException(`Prosthesis type with ID "${prosthesisTypeId}" not found.`);
    }

    const assignments = await this.prisma.prosthesisTypeProcess.findMany({
      where: { prosthesisTypeId },
      orderBy: { sequence: 'asc' },
      include: {
        process: {
          include: {
            defaultTechnician: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            branch: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return assignments;
  }
}
