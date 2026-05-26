import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProcessDto, UpdateProcessDto } from './dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class ProcessesService {
  private readonly logger = new Logger(ProcessesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, branchIdContext: string | null, userRole: string, dto: CreateProcessDto) {
    const { name, processArea, defaultTechnicianId, prosthesisTypeId, branchId } = dto;

    // Force branch for Administrators
    let finalBranchId = branchId;
    if (userRole === 'ADMIN') {
      if (!branchIdContext) {
        throw new BadRequestException('Branch context is required for administrators.');
      }
      finalBranchId = branchIdContext;
    }

    // 1. Verify prosthesis type belongs to tenant
    const prosthesisType = await this.prisma.prosthesisType.findFirst({
      where: { id: prosthesisTypeId, tenantId },
    });
    if (!prosthesisType) {
      throw new NotFoundException(`Prosthesis type with ID "${prosthesisTypeId}" not found.`);
    }

    // 2. Verify branch belongs to tenant if provided
    if (finalBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: finalBranchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundException(`Branch with ID "${finalBranchId}" does not exist in your organization.`);
      }
    }

    // 3. Verify default technician exists, has role TECHNICIAN, belongs to same tenant, and same branch
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

    // Find the current max sequence for this prosthesis type
    const maxProcess = await this.prisma.process.findFirst({
      where: { tenantId, prosthesisTypeId },
      orderBy: { sequence: 'desc' },
      select: { sequence: true },
    });
    const nextSequence = maxProcess ? maxProcess.sequence + 1 : 0;

    const process = await this.prisma.process.create({
      data: {
        tenantId,
        branchId: finalBranchId || null,
        name,
        processArea,
        defaultTechnicianId,
        prosthesisTypeId,
        sequence: nextSequence,
      },
      include: {
        prosthesisType: true,
        branch: {
          select: { id: true, name: true },
        },
        defaultTechnician: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    this.logger.log(`Process created: ${process.name} (${process.id}) for tenant ${tenantId}`);
    return process;
  }

  async findAll(tenantId: string, branchIdFilter?: string) {
    return this.prisma.process.findMany({
      where: {
        tenantId,
        ...(branchIdFilter && branchIdFilter !== 'ALL' && { branchId: branchIdFilter }),
      },
      include: {
        prosthesisType: true,
        branch: {
          select: { id: true, name: true },
        },
        defaultTechnician: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: [
        { prosthesisTypeId: 'asc' },
        { sequence: 'asc' },
        { createdAt: 'asc' },
      ],
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
        prosthesisType: true,
        branch: {
          select: { id: true, name: true },
        },
        defaultTechnician: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!process) {
      throw new NotFoundException(`Process with ID "${id}" not found.`);
    }

    return process;
  }

  async update(tenantId: string, id: string, dto: UpdateProcessDto, branchIdContext?: string | null) {
    // Verify existence
    const existingProcess = await this.findOne(tenantId, id, branchIdContext);

    const { name, processArea, defaultTechnicianId, prosthesisTypeId, branchId } = dto;

    let finalBranchId = branchId !== undefined ? branchId : existingProcess.branchId;

    // 1. Verify prosthesis type belongs to tenant if updated
    if (prosthesisTypeId) {
      const prosthesisType = await this.prisma.prosthesisType.findFirst({
        where: { id: prosthesisTypeId, tenantId },
      });
      if (!prosthesisType) {
        throw new NotFoundException(`Prosthesis type with ID "${prosthesisTypeId}" not found.`);
      }
    }

    // 2. Verify branch belongs to tenant if updated
    if (finalBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: finalBranchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundException(`Branch with ID "${finalBranchId}" does not exist in your organization.`);
      }
    }

    // 3. Verify default technician exists, has role TECHNICIAN, belongs to same tenant, and same branch
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
        ...(prosthesisTypeId && { prosthesisTypeId }),
        ...(branchId !== undefined && { branchId: finalBranchId || null }),
      },
      include: {
        prosthesisType: true,
        branch: {
          select: { id: true, name: true },
        },
        defaultTechnician: {
          select: { id: true, firstName: true, lastName: true, email: true },
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

  async reorder(tenantId: string, prosthesisTypeId: string, processIds: string[]) {
    // Verify prosthesis type belongs to tenant
    const prosthesisType = await this.prisma.prosthesisType.findFirst({
      where: { id: prosthesisTypeId, tenantId },
    });
    if (!prosthesisType) {
      throw new NotFoundException(`Prosthesis type with ID "${prosthesisTypeId}" not found.`);
    }

    // Update sequences inside a transaction
    await this.prisma.$transaction(
      processIds.map((id, index) =>
        this.prisma.process.updateMany({
          where: { id, tenantId, prosthesisTypeId },
          data: { sequence: index },
        }),
      ),
    );

    this.logger.log(`Processes reordered for prosthesis type: ${prosthesisTypeId}`);
    return { success: true };
  }
}
