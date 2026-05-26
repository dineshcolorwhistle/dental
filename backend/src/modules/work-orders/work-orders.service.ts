import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateWorkOrderDto, UpdateWorkOrderDto } from './dto';
import { WorkOrderStatus, UserRole } from '@prisma/client';

@Injectable()
export class WorkOrdersService {
  private readonly logger = new Logger(WorkOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Standard includes for returning full work order data
  private readonly fullInclude = {
    doctor: {
      select: { id: true, name: true, clinicName: true },
    },
    prosthesisType: {
      select: { id: true, name: true },
    },
    branch: {
      select: { id: true, name: true, code: true },
    },
    createdBy: {
      select: { id: true, firstName: true, lastName: true, email: true },
    },
    processes: {
      orderBy: { sequence: 'asc' as const },
      include: {
        technician: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    },
  };

  /**
   * Generate the next folio number for a branch.
   * Format: <BranchCode><4-digit sequential> e.g. BRN0001
   */
  private async generateFolioNumber(tenantId: string, branchId: string): Promise<string> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { code: true },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID "${branchId}" not found.`);
    }

    // Count existing work orders for this branch to determine next number
    const count = await this.prisma.workOrder.count({
      where: { tenantId, branchId },
    });

    const nextNumber = (count + 1).toString().padStart(4, '0');
    return `${branch.code}${nextNumber}`;
  }

  async create(
    tenantId: string,
    branchIdContext: string | null,
    userId: string,
    userRole: string,
    dto: CreateWorkOrderDto,
  ) {
    const {
      doctorId,
      patient,
      boxNumber,
      prosthesisTypeId,
      specification,
      notes,
      totalQuote,
      initialPayment,
      branchId,
      action,
      processes,
    } = dto;

    // Force branch for Administrators
    let finalBranchId = branchId;
    if (userRole === 'ADMIN') {
      if (!branchIdContext) {
        throw new BadRequestException('Branch context is required for administrators.');
      }
      finalBranchId = branchIdContext;
    }

    if (!finalBranchId) {
      throw new BadRequestException('Branch is required to create a work order.');
    }

    // 1. Verify branch belongs to tenant
    const branchRecord = await this.prisma.branch.findFirst({
      where: { id: finalBranchId, tenantId },
    });
    if (!branchRecord) {
      throw new NotFoundException(`Branch with ID "${finalBranchId}" does not exist in your organization.`);
    }

    // 2. Verify doctor belongs to tenant
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, tenantId },
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID "${doctorId}" not found.`);
    }

    // 3. Verify prosthesis type belongs to tenant
    const prosthesisType = await this.prisma.prosthesisType.findFirst({
      where: { id: prosthesisTypeId, tenantId },
    });
    if (!prosthesisType) {
      throw new NotFoundException(`Prosthesis type with ID "${prosthesisTypeId}" not found.`);
    }

    // 4. Generate folio number
    const folioNumber = await this.generateFolioNumber(tenantId, finalBranchId);

    // 5. Determine status based on action
    const status = action === 'createAndAssign'
      ? WorkOrderStatus.ASSIGNED
      : WorkOrderStatus.CREATED;

    // 6. Strip specification if user is not ADMIN
    const finalSpecification = userRole === 'ADMIN' ? specification : undefined;

    // 7. Create work order with processes in a transaction
    const workOrder = await this.prisma.workOrder.create({
      data: {
        tenantId,
        branchId: finalBranchId,
        folioNumber,
        doctorId,
        patient,
        boxNumber: boxNumber || null,
        prosthesisTypeId,
        specification: finalSpecification || null,
        notes: notes || null,
        totalQuote: totalQuote ?? null,
        initialPayment: initialPayment ?? null,
        status,
        createdById: userId,
        processes: {
          create: processes.map((p) => ({
            processName: p.processName,
            technicianId: p.technicianId || null,
            sequence: p.sequence,
            isVerification: p.isVerification || false,
          })),
        },
      },
      include: this.fullInclude,
    });

    // 8. If createAndAssign, notify the first process's technician
    if (action === 'createAndAssign' && processes.length > 0) {
      // Find the first process step (lowest sequence)
      const sortedProcesses = [...processes].sort((a, b) => a.sequence - b.sequence);
      const firstProcess = sortedProcesses[0];

      if (firstProcess.technicianId) {
        await this.notificationsService.create({
          tenantId,
          userId: firstProcess.technicianId,
          title: 'New Work Order Assigned',
          message: `You have been assigned to "${firstProcess.processName}" for work order ${folioNumber} (Patient: ${patient}).`,
          type: 'WORK_ORDER',
          referenceId: workOrder.id,
        });
      }
    }

    this.logger.log(`Work order created: ${folioNumber} (${workOrder.id}) for tenant ${tenantId}`);
    return workOrder;
  }

  async findAll(tenantId: string, branchIdFilter?: string, statusFilter?: string) {
    return this.prisma.workOrder.findMany({
      where: {
        tenantId,
        ...(branchIdFilter && branchIdFilter !== 'ALL' && { branchId: branchIdFilter }),
        ...(statusFilter && statusFilter !== 'ALL' && { status: statusFilter as WorkOrderStatus }),
      },
      include: this.fullInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string, branchIdContext?: string | null) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        id,
        tenantId,
        ...(branchIdContext && { branchId: branchIdContext }),
      },
      include: this.fullInclude,
    });

    if (!workOrder) {
      throw new NotFoundException(`Work order with ID "${id}" not found.`);
    }

    return workOrder;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateWorkOrderDto,
    branchIdContext?: string | null,
  ) {
    // Verify existence
    await this.findOne(tenantId, id, branchIdContext);

    const {
      doctorId,
      patient,
      boxNumber,
      prosthesisTypeId,
      specification,
      notes,
      totalQuote,
      initialPayment,
      processes,
    } = dto;

    // Verify doctor if updated
    if (doctorId) {
      const doctor = await this.prisma.doctor.findFirst({
        where: { id: doctorId, tenantId },
      });
      if (!doctor) {
        throw new NotFoundException(`Doctor with ID "${doctorId}" not found.`);
      }
    }

    // Verify prosthesis type if updated
    if (prosthesisTypeId) {
      const pt = await this.prisma.prosthesisType.findFirst({
        where: { id: prosthesisTypeId, tenantId },
      });
      if (!pt) {
        throw new NotFoundException(`Prosthesis type with ID "${prosthesisTypeId}" not found.`);
      }
    }

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        ...(doctorId && { doctorId }),
        ...(patient && { patient }),
        ...(boxNumber !== undefined && { boxNumber: boxNumber || null }),
        ...(prosthesisTypeId && { prosthesisTypeId }),
        ...(specification !== undefined && { specification: specification || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(totalQuote !== undefined && { totalQuote }),
        ...(initialPayment !== undefined && { initialPayment }),
        ...(processes && {
          processes: {
            deleteMany: {},
            create: processes.map((p) => ({
              processName: p.processName,
              technicianId: p.technicianId || null,
              sequence: p.sequence,
              isVerification: p.isVerification || false,
            })),
          },
        }),
      },
      include: this.fullInclude,
    });

    this.logger.log(`Work order updated: ${updated.folioNumber} (${updated.id})`);
    return updated;
  }

  async getNextFolioNumber(tenantId: string, branchId: string) {
    const folioNumber = await this.generateFolioNumber(tenantId, branchId);
    return { folioNumber };
  }

  async remove(tenantId: string, id: string, branchIdContext?: string | null) {
    await this.findOne(tenantId, id, branchIdContext);

    await this.prisma.workOrder.delete({
      where: { id },
    });

    this.logger.log(`Work order deleted: ${id} inside tenant ${tenantId}`);
    return { success: true };
  }
}
