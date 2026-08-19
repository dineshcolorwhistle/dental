import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProcessDto, UpdateProcessDto } from './dto';
import { ProcessType } from '@prisma/client';

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
    const {
      name,
      type = ProcessType.PRODUCTION,
      processAreaId,
      defaultTechnicianId,
      branchId,
    } = dto;

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

    const processTypeStr = String(type || 'PRODUCTION');

    let processAreaName =
      processTypeStr === 'INTERNAL_VERIFICATION'
        ? 'Internal Verification'
        : processTypeStr === 'EXTERNAL_VERIFICATION'
          ? 'External Verification'
          : 'General';

    if (processAreaId) {
      const processAreaRecord = await this.prisma.processArea.findFirst({
        where: {
          id: processAreaId,
          tenantId,
          ...(finalBranchId && { branchId: finalBranchId }),
        },
      });

      if (!processAreaRecord) {
        throw new BadRequestException(
          'Selected Process Area is invalid or does not belong to the selected branch.',
        );
      }
      processAreaName = processAreaRecord.name;
    } else if (processTypeStr === 'PRODUCTION') {
      throw new BadRequestException(
        'Process Area is required for production processes.',
      );
    }

    // 2. Verify pre-assigned user depending on process type
    let finalDefaultTechnicianId: string | null = null;

    if (processTypeStr === 'EXTERNAL_VERIFICATION') {
      finalDefaultTechnicianId = null;
    } else if (processTypeStr === 'INTERNAL_VERIFICATION') {
      if (!defaultTechnicianId) {
        throw new BadRequestException(
          'Default admin assignment is required for internal verification processes.',
        );
      }
      const adminUser = await this.prisma.user.findFirst({
        where: {
          id: defaultTechnicianId,
          tenantId,
        },
      });

      if (!adminUser) {
        throw new BadRequestException(
          'Assigned user for internal verification was not found.',
        );
      }
      finalDefaultTechnicianId = defaultTechnicianId;
    } else {
      if (!defaultTechnicianId) {
        throw new BadRequestException(
          'Default technician is required for production processes.',
        );
      }
      const technician = await this.prisma.user.findFirst({
        where: {
          id: defaultTechnicianId,
          tenantId,
        },
      });

      if (!technician) {
        throw new BadRequestException(
          'Default technician is not valid in your organization.',
        );
      }
      finalDefaultTechnicianId = defaultTechnicianId;
    }

    const process = await this.prisma.process.create({
      data: {
        tenantId,
        branchId: finalBranchId || null,
        name,
        type,
        processArea: processAreaName, // Sync legacy column
        processAreaId: processAreaId || null,
        defaultTechnicianId: finalDefaultTechnicianId,
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
      `Process created: ${process.name} (${process.id}) [Type: ${process.type}] for tenant ${tenantId}`,
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

    const { name, type, processAreaId, defaultTechnicianId, branchId } = dto;

    const finalBranchId =
      branchId !== undefined ? branchId : existingProcess.branchId;
    const finalType = type || existingProcess.type;

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

    // Verify process area exists and belongs to correct tenant/branch if updated
    let resolvedProcessAreaName = undefined;
    if (processAreaId) {
      const processAreaRecord = await this.prisma.processArea.findFirst({
        where: {
          id: processAreaId,
          tenantId,
          ...(finalBranchId && { branchId: finalBranchId }),
        },
      });
      if (!processAreaRecord) {
        throw new BadRequestException(
          'Selected Process Area is invalid or does not belong to the selected branch.',
        );
      }
      resolvedProcessAreaName = processAreaRecord.name;
    }

    const finalTypeStr = String(finalType || 'PRODUCTION');

    // Verify assigned user based on finalTypeStr
    let finalDefaultTechnicianId: string | null | undefined =
      defaultTechnicianId !== undefined
        ? defaultTechnicianId
        : existingProcess.defaultTechnicianId;

    if (finalTypeStr === 'EXTERNAL_VERIFICATION') {
      finalDefaultTechnicianId = null;
    } else if (defaultTechnicianId) {
      const userRecord = await this.prisma.user.findFirst({
        where: {
          id: defaultTechnicianId,
          tenantId,
        },
      });

      if (!userRecord) {
        throw new BadRequestException(
          'Assigned user is not valid in your organization.',
        );
      }
    }

    const updated = await this.prisma.process.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(processAreaId !== undefined && {
          processAreaId: processAreaId || null,
        }),
        ...(resolvedProcessAreaName && {
          processArea: resolvedProcessAreaName,
        }), // Sync legacy column
        defaultTechnicianId: finalDefaultTechnicianId,
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
