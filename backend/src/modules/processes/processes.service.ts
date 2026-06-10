import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProcessDto, UpdateProcessDto } from './dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class ProcessesService {
  private readonly logger = new Logger(ProcessesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    branchIdContext: string | null,
    userRole: string,
    dto: CreateProcessDto,
  ) {
    const { name, processArea, defaultTechnicianId, branchId } = dto;

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

    // 1. Verify branch belongs to tenant if provided
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

    // 2. Verify default technician exists, has role TECHNICIAN, belongs to same tenant, and same branch
    const technician = await this.prisma.user.findFirst({
      where: {
        id: defaultTechnicianId,
        tenantId,
        role: UserRole.TECHNICIAN,
        ...(finalBranchId && { branchId: finalBranchId }),
      },
    });

    if (!technician) {
      throw new BadRequestException(
        `Default technician is not a valid technician in the assigned branch.`,
      );
    }

    const process = await this.prisma.process.create({
      data: {
        tenantId,
        branchId: finalBranchId || null,
        name,
        processArea,
        defaultTechnicianId,
      },
      include: {
        branch: {
          select: { id: true, name: true },
        },
        defaultTechnician: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        prosthesisTypeAssignments: {
          include: {
            prosthesisType: {
              select: { id: true, name: true },
            },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    this.logger.log(
      `Process created: ${process.name} (${process.id}) for tenant ${tenantId}`,
    );
    return process;
  }

  async findAll(tenantId: string, branchIdFilter?: string) {
    return this.prisma.process.findMany({
      where: {
        tenantId,
        ...(branchIdFilter &&
          branchIdFilter !== 'ALL' && { branchId: branchIdFilter }),
      },
      include: {
        branch: {
          select: { id: true, name: true },
        },
        defaultTechnician: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        prosthesisTypeAssignments: {
          include: {
            prosthesisType: {
              select: { id: true, name: true },
            },
          },
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string, branchIdContext?: string | null) {
    const process = await this.prisma.process.findFirst({
      where: {
        id,
        tenantId,
        ...(branchIdContext && { branchId: branchIdContext }),
      },
      include: {
        branch: {
          select: { id: true, name: true },
        },
        defaultTechnician: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        prosthesisTypeAssignments: {
          include: {
            prosthesisType: {
              select: { id: true, name: true },
            },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!process) {
      throw new NotFoundException(`Process with ID "${id}" not found.`);
    }

    return process;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateProcessDto,
    branchIdContext?: string | null,
  ) {
    // Verify existence
    const existingProcess = await this.findOne(tenantId, id, branchIdContext);

    const { name, processArea, defaultTechnicianId, branchId } = dto;

    const finalBranchId =
      branchId !== undefined ? branchId : existingProcess.branchId;

    // 1. Verify branch belongs to tenant if updated
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

    // 2. Verify default technician exists, has role TECHNICIAN, belongs to same tenant, and same branch
    if (defaultTechnicianId) {
      const technician = await this.prisma.user.findFirst({
        where: {
          id: defaultTechnicianId,
          tenantId,
          role: UserRole.TECHNICIAN,
          ...(finalBranchId && { branchId: finalBranchId }),
        },
      });

      if (!technician) {
        throw new BadRequestException(
          `Default technician is not a valid technician in the assigned branch.`,
        );
      }
    }

    const updated = await this.prisma.process.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(processArea && { processArea }),
        ...(defaultTechnicianId && { defaultTechnicianId }),
        ...(branchId !== undefined && { branchId: finalBranchId || null }),
      },
      include: {
        branch: {
          select: { id: true, name: true },
        },
        defaultTechnician: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        prosthesisTypeAssignments: {
          include: {
            prosthesisType: {
              select: { id: true, name: true },
            },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    this.logger.log(`Process updated: ${updated.name} (${updated.id})`);
    return updated;
  }

  async remove(tenantId: string, id: string, branchIdContext?: string | null) {
    await this.findOne(tenantId, id, branchIdContext);

    await this.prisma.process.delete({
      where: { id },
    });

    this.logger.log(`Process deleted: ${id} inside tenant ${tenantId}`);
    return { success: true };
  }
}
