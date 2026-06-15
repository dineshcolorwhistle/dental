import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WebsocketsGateway } from '../websockets/websockets.gateway';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateWorkOrderDto, UpdateWorkOrderDto } from './dto';
import {
  WorkOrderStatus,
  UserRole,
  ProcessStatus,
  ProcessActivityAction,
} from '@prisma/client';

@Injectable()
export class WorkOrdersService {
  private readonly logger = new Logger(WorkOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly websocketsGateway: WebsocketsGateway,
  ) {}

  /**
   * Helper to calculate overall Work Order status from underlying processes.
   */
  private calculateWorkOrderStatus(
    processes: {
      isVerification: boolean;
      technicianId: string | null;
      status: ProcessStatus;
    }[],
  ): WorkOrderStatus {
    if (processes.length === 0) {
      return WorkOrderStatus.CREATED;
    }

    // 1. If any process is FAILED -> FAILED
    if (processes.some((p) => p.status === ProcessStatus.FAILED)) {
      return WorkOrderStatus.FAILED;
    }

    // 2. If any process is CANCELLED -> CANCELLED
    if (processes.some((p) => p.status === ProcessStatus.CANCELLED)) {
      return WorkOrderStatus.CANCELLED;
    }

    // 3. If all processes are COMPLETED -> COMPLETED
    if (processes.every((p) => p.status === ProcessStatus.COMPLETED)) {
      return WorkOrderStatus.COMPLETED;
    }

    // 4. If any process is IN_PROGRESS or PAUSED
    const inProgressProc = processes.find(
      (p) =>
        p.status === ProcessStatus.IN_PROGRESS ||
        p.status === ProcessStatus.PAUSED,
    );
    if (inProgressProc) {
      if (inProgressProc.isVerification) {
        return inProgressProc.technicianId
          ? WorkOrderStatus.INTERNAL_VERIFICATION
          : WorkOrderStatus.EXTERNAL_VERIFICATION;
      }
      return WorkOrderStatus.IN_PROGRESS;
    }

    // 5. Otherwise, check assignments
    const allNotStarted = processes.every(
      (p) => p.status === ProcessStatus.NOT_STARTED,
    );
    if (allNotStarted) {
      const hasAnyTechnician = processes.some((p) => p.technicianId !== null);
      return hasAnyTechnician
        ? WorkOrderStatus.ASSIGNED
        : WorkOrderStatus.CREATED;
    }

    // Default fallback
    return WorkOrderStatus.IN_PROGRESS;
  }

  // Standard includes for returning full work order data
  private readonly fullInclude = {
    doctor: {
      select: { id: true, name: true, clinicName: true },
    },
    prosthesisType: {
      select: { id: true, name: true },
    },
    branch: {
      select: { id: true, name: true, code: true, defaultAdminId: true },
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
        activityLogs: {
          orderBy: { timestamp: 'asc' as const },
        },
      },
    },
    reworkLogs: {
      orderBy: { initiatedAt: 'desc' as const },
      include: {
        initiatedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        technician: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    },
    repetitionLogs: {
      orderBy: { initiatedAt: 'desc' as const },
      include: {
        initiatedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    },
  };

  /**
   * Generate the next folio number for a branch.
   * Format: <BranchCode><4-digit sequential> e.g. BRN0001
   */
  private async generateFolioNumber(
    tenantId: string,
    branchId: string,
  ): Promise<string> {
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
      color,
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
        throw new BadRequestException(
          'Branch context is required for administrators.',
        );
      }
      finalBranchId = branchIdContext;
    }

    if (!finalBranchId) {
      throw new BadRequestException(
        'Branch is required to create a work order.',
      );
    }

    // 1. Verify branch belongs to tenant
    const branchRecord = await this.prisma.branch.findFirst({
      where: { id: finalBranchId, tenantId },
    });
    if (!branchRecord) {
      throw new NotFoundException(
        `Branch with ID "${finalBranchId}" does not exist in your organization.`,
      );
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
      throw new NotFoundException(
        `Prosthesis type with ID "${prosthesisTypeId}" not found.`,
      );
    }

    // 4. Generate folio number
    const folioNumber = await this.generateFolioNumber(tenantId, finalBranchId);

    // 5. Determine processes and status
    const mappedProcesses = processes.map((p) => ({
      processName: p.processName,
      technicianId: p.technicianId || null,
      sequence: p.sequence,
      isVerification: p.isVerification || false,
      status: (p as any).status || ProcessStatus.NOT_STARTED,
    }));

    const status =
      action === 'create'
        ? WorkOrderStatus.CREATED
        : this.calculateWorkOrderStatus(mappedProcesses);

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
        color,
        notes: notes || null,
        totalQuote: totalQuote ?? null,
        initialPayment: initialPayment ?? null,
        status,
        createdById: userId,
        processes: {
          create: mappedProcesses,
        },
      },
      include: this.fullInclude,
    });

    // 8. If createAndAssign, notify the first process's technician
    if (action === 'createAndAssign' && workOrder.processes.length > 0) {
      // Find the first process step (lowest sequence)
      const sortedProcesses = [...workOrder.processes].sort(
        (a, b) => a.sequence - b.sequence,
      );
      const firstProcess = sortedProcesses[0];

      if (firstProcess.technicianId) {
        await this.notificationsService.create({
          tenantId,
          userId: firstProcess.technicianId,
          title: 'New Work Order Assigned',
          message: `You have been assigned to "${firstProcess.processName}" for work order ${folioNumber} (Patient: ${patient})${boxNumber ? ` (Box: ${boxNumber})` : ''}.`,
          type: 'WORK_ORDER',
          referenceId: workOrder.id,
        });

        // Audit Log for notification
        await this.auditLogsService.log({
          tenantId,
          userId,
          action: 'NOTIFICATION_TRIGGERED',
          entityName: 'NOTIFICATION',
          entityId: workOrder.id,
          details: {
            userId: firstProcess.technicianId,
            title: 'New Work Order Assigned',
            message: `You have been assigned to "${firstProcess.processName}" for work order ${folioNumber} (Patient: ${patient})${boxNumber ? ` (Box: ${boxNumber})` : ''}.`,
          },
        });
      } else if (firstProcess.isVerification && !firstProcess.technicianId) {
        // Auto-start External Verification
        const now = new Date();
        await this.prisma.workOrderProcess.update({
          where: { id: firstProcess.id },
          data: {
            status: ProcessStatus.IN_PROGRESS,
            startedAt: now,
            activityLogs: {
              create: {
                action: ProcessActivityAction.START,
                timestamp: now,
                notes: 'External verification started automatically',
              },
            },
          },
        });

        await this.auditLogsService.log({
          tenantId,
          userId,
          action: 'VERIFICATION_START',
          entityName: 'PROCESS',
          entityId: firstProcess.id,
          details: {
            workOrderId: workOrder.id,
            processName: firstProcess.processName,
            type: 'EXTERNAL',
            notes: 'Started automatically on assignment',
          },
        });

        await this.updateWorkOrderStatus(workOrder.id);

        const updatedWO = await this.findOne(
          tenantId,
          workOrder.id,
          null,
          userRole,
        );
        return updatedWO;
      }
    }

    // Write Audit Log for WO creation
    await this.auditLogsService.log({
      tenantId,
      userId,
      action: action === 'createAndAssign' ? 'CREATE_AND_ASSIGN' : 'CREATE',
      entityName: 'WORK_ORDER',
      entityId: workOrder.id,
      details: {
        folioNumber,
        patient,
        prosthesisTypeId,
        status,
        processesCount: mappedProcesses.length,
      },
    });

    this.logger.log(
      `Work order created: ${folioNumber} (${workOrder.id}) for tenant ${tenantId}`,
    );

    this.websocketsGateway.sendToBranch(tenantId, finalBranchId, 'work_order_created', {
      id: workOrder.id,
      folioNumber,
      patient,
      status: workOrder.status,
    });

    return workOrder;
  }

  async findAll(
    tenantId: string,
    branchIdFilter?: string,
    statusFilter?: string,
  ) {
    return this.prisma.workOrder.findMany({
      where: {
        tenantId,
        ...(branchIdFilter &&
          branchIdFilter !== 'ALL' && { branchId: branchIdFilter }),
        ...(statusFilter &&
          statusFilter !== 'ALL' && {
            status: statusFilter as WorkOrderStatus,
          }),
      },
      include: this.fullInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(
    tenantId: string,
    id: string,
    branchIdContext?: string | null,
    userRole?: string,
  ) {
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

    // Sanitize financial details for technicians and delivery staff
    if (userRole === 'TECHNICIAN' || userRole === 'DELIVERY') {
      const { totalQuote, initialPayment, ...sanitized } = workOrder;
      return {
        ...sanitized,
        totalQuote: null,
        initialPayment: null,
      } as any;
    }

    return workOrder;
  }

  async findOneByQrToken(
    tenantId: string,
    qrToken: string,
    branchIdContext?: string | null,
    userRole?: string,
  ) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        qrToken,
        tenantId,
        ...(branchIdContext && { branchId: branchIdContext }),
      },
      include: this.fullInclude,
    });

    if (!workOrder) {
      throw new NotFoundException(`Work order with QR token not found.`);
    }

    // Sanitize financial details for technicians, delivery, or general QR scans
    if (userRole === 'TECHNICIAN' || userRole === 'DELIVERY') {
      const { totalQuote, initialPayment, ...sanitized } = workOrder;
      return {
        ...sanitized,
        totalQuote: null,
        initialPayment: null,
      } as any;
    }

    return workOrder;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateWorkOrderDto,
    branchIdContext?: string | null,
    userId?: string,
  ) {
    // Verify existence
    const existing = await this.findOne(tenantId, id, branchIdContext);

    const {
      doctorId,
      patient,
      boxNumber,
      prosthesisTypeId,
      specification,
      color,
      notes,
      totalQuote,
      initialPayment,
      processes,
      status,
    } = dto;

    // Strict sequential and locking validation
    if (processes) {
      for (const ep of existing.processes) {
        if (ep.status !== ProcessStatus.NOT_STARTED) {
          // This process has started. It must be present in the new processes list at the exact same sequence.
          const p = processes.find((item) => item.sequence === ep.sequence);
          if (!p) {
            throw new BadRequestException(
              `Cannot delete or reorder already started process step "${ep.processName}".`,
            );
          }
          if (
            p.processName !== ep.processName ||
            (p.isVerification || false) !== ep.isVerification
          ) {
            throw new BadRequestException(
              `Cannot modify configuration of already started process step "${ep.processName}".`,
            );
          }
          if ((p.technicianId || null) !== (ep.technicianId || null)) {
            throw new BadRequestException(
              `Cannot change assigned technician for already started process step "${ep.processName}".`,
            );
          }
          const isReworkingThisStep =
            p.rework === true &&
            ep.status === ProcessStatus.COMPLETED &&
            (p.status === ProcessStatus.NOT_STARTED || !p.status);
          if (
            (p.status || ProcessStatus.NOT_STARTED) !== ep.status &&
            !isReworkingThisStep
          ) {
            throw new BadRequestException(
              `Cannot modify status of already started process step "${ep.processName}".`,
            );
          }
        }
      }
    }

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
        throw new NotFoundException(
          `Prosthesis type with ID "${prosthesisTypeId}" not found.`,
        );
      }
    }

    let finalStatus = status;
    let minReworkSeq = Infinity;
    let mappedProcesses = undefined;

    if (processes) {
      // Find reworked steps
      const reworkedItems = processes.filter((p) => p.rework === true);
      if (reworkedItems.length > 0) {
        minReworkSeq = Math.min(...reworkedItems.map((p) => p.sequence));
      }

      mappedProcesses = processes.map((p) => {
        const ep = existing.processes.find(
          (item: any) => item.sequence === p.sequence,
        );
        const isReworked =
          p.rework === true &&
          ep &&
          ep.status === ProcessStatus.COMPLETED &&
          !ep.reworkActive;

        let statusVal = (p as any).status || ProcessStatus.NOT_STARTED;
        let startedAt = ep ? ep.startedAt : null;
        let endedAt = ep ? ep.endedAt : null;
        let verificationStatus = ep ? ep.verificationStatus : null;
        let reworkCount = ep ? ep.reworkCount : 0;
        let reworkActive = ep ? ep.reworkActive : false;

        if (isReworked) {
          statusVal = ProcessStatus.NOT_STARTED;
          startedAt = null;
          endedAt = null;
          verificationStatus = null;
          reworkCount = reworkCount + 1;
          reworkActive = true;
        } else if (p.isVerification && p.sequence > minReworkSeq) {
          statusVal = ProcessStatus.NOT_STARTED;
          startedAt = null;
          endedAt = null;
          verificationStatus = null;
          reworkActive = false;
        } else if (p.rework === false && ep && ep.reworkActive === true) {
          reworkActive = false;
        }

        return {
          id: ep?.id || null, // Preserve ID if it exists
          processName: p.processName,
          technicianId: p.technicianId || null,
          sequence: p.sequence,
          isVerification: p.isVerification || false,
          status: statusVal,
          startedAt,
          endedAt,
          verificationStatus,
          reworkCount,
          reworkActive,
          isReworked,
        };
      });
    }

    if (
      finalStatus === WorkOrderStatus.FAILED ||
      finalStatus === WorkOrderStatus.CANCELLED
    ) {
      const targetStatus =
        finalStatus === WorkOrderStatus.FAILED
          ? ProcessStatus.FAILED
          : ProcessStatus.CANCELLED;
      if (mappedProcesses) {
        mappedProcesses = mappedProcesses.map((p) => ({
          ...p,
          status: targetStatus,
        }));
      } else {
        await this.prisma.workOrderProcess.updateMany({
          where: { workOrderId: id },
          data: { status: targetStatus },
        });
      }
    } else if (processes && mappedProcesses) {
      finalStatus = this.calculateWorkOrderStatus(mappedProcesses);
    }

    // Transition from CREATED to ASSIGNED triggers assignment logic
    const isTransitioningToAssigned =
      existing.status === WorkOrderStatus.CREATED &&
      (finalStatus === WorkOrderStatus.ASSIGNED ||
        (mappedProcesses &&
          finalStatus === undefined &&
          this.calculateWorkOrderStatus(mappedProcesses) ===
            WorkOrderStatus.ASSIGNED));

    const actualFinalStatus = isTransitioningToAssigned
      ? WorkOrderStatus.ASSIGNED
      : finalStatus || existing.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Delete processes that are not in incoming mappedProcesses list (only if NOT_STARTED)
      if (mappedProcesses) {
        const incomingSequences = mappedProcesses.map((p) => p.sequence);
        const toDelete = existing.processes.filter(
          (ep: any) => !incomingSequences.includes(ep.sequence),
        );
        for (const ep of toDelete) {
          await tx.workOrderProcess.delete({
            where: { id: ep.id },
          });
        }

        // 2. Update existing and create new processes
        for (const p of mappedProcesses) {
          if (p.id) {
            await tx.workOrderProcess.update({
              where: { id: p.id },
              data: {
                technicianId: p.technicianId,
                sequence: p.sequence,
                isVerification: p.isVerification,
                status: p.status,
                startedAt: p.startedAt,
                endedAt: p.endedAt,
                verificationStatus: p.verificationStatus,
                reworkCount: p.reworkCount,
                reworkActive: p.reworkActive,
              },
            });

            if (p.isReworked) {
              const triggeringVerification = existing.processes
                .filter(
                  (ep: any) => ep.isVerification && ep.sequence > p.sequence,
                )
                .sort((a: any, b: any) => a.sequence - b.sequence)[0];
              const verificationStage = triggeringVerification
                ? triggeringVerification.processName
                : 'Verification';

              await tx.reworkLog.create({
                data: {
                  workOrderId: id,
                  processName: p.processName,
                  reworkCount: p.reworkCount,
                  initiatedById: userId || '',
                  verificationStage,
                  technicianId: p.technicianId,
                  status: 'Pending',
                },
              });
            }
          } else {
            await tx.workOrderProcess.create({
              data: {
                workOrderId: id,
                processName: p.processName,
                technicianId: p.technicianId,
                sequence: p.sequence,
                isVerification: p.isVerification,
                status: p.status,
                startedAt: p.startedAt,
                endedAt: p.endedAt,
                verificationStatus: p.verificationStatus,
                reworkCount: p.reworkCount,
                reworkActive: p.reworkActive,
              },
            });
          }
        }
      } else if (
        finalStatus === WorkOrderStatus.FAILED ||
        finalStatus === WorkOrderStatus.CANCELLED
      ) {
        const targetStatus =
          finalStatus === WorkOrderStatus.FAILED
            ? ProcessStatus.FAILED
            : ProcessStatus.CANCELLED;
        await tx.workOrderProcess.updateMany({
          where: { workOrderId: id },
          data: { status: targetStatus },
        });
      }

      // 3. Update work order details and status
      return tx.workOrder.update({
        where: { id },
        data: {
          ...(doctorId && { doctorId }),
          ...(patient && { patient }),
          ...(boxNumber !== undefined && { boxNumber: boxNumber || null }),
          ...(prosthesisTypeId && { prosthesisTypeId }),
          ...(specification !== undefined && {
            specification: specification || null,
          }),
          ...(color !== undefined && { color }),
          ...(notes !== undefined && { notes: notes || null }),
          ...(totalQuote !== undefined && { totalQuote }),
          ...(initialPayment !== undefined && { initialPayment }),
          status: actualFinalStatus,
        },
        include: this.fullInclude,
      });
    });

    // Write Rework Audit Logs and Trigger Notifications
    if (minReworkSeq !== Infinity && mappedProcesses) {
      const sortedReworked = mappedProcesses
        .filter((p) => p.isReworked)
        .sort((a, b) => a.sequence - b.sequence);
      const firstReworked = sortedReworked[0];

      if (firstReworked && firstReworked.technicianId) {
        await this.notificationsService.create({
          tenantId,
          userId: firstReworked.technicianId,
          title: 'Work Order Flagged for Rework',
          message: `Work Order "${updated.folioNumber}" has been flagged for rework. Please review step "${firstReworked.processName}".`,
          type: 'WORK_ORDER',
          referenceId: updated.id,
        });

        await this.auditLogsService.log({
          tenantId,
          userId,
          action: 'NOTIFICATION_TRIGGERED',
          entityName: 'NOTIFICATION',
          entityId: updated.id,
          details: {
            userId: firstReworked.technicianId,
            title: 'Work Order Flagged for Rework',
          },
        });
      }

      for (const p of sortedReworked) {
        await this.auditLogsService.log({
          tenantId,
          userId,
          action: 'REWORK_TRIGGERED',
          entityName: 'PROCESS',
          entityId: p.id || updated.id,
          details: {
            workOrderId: updated.id,
            processName: p.processName,
            initiatedBy: userId,
            reworkCount: p.reworkCount,
            previousStatus: 'COMPLETED',
            updatedStatus: 'NOT_STARTED',
          },
        });
      }
    }

    // Write Audit Log for update
    await this.auditLogsService.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entityName: 'WORK_ORDER',
      entityId: updated.id,
      details: {
        oldStatus: existing.status,
        newStatus: updated.status,
        updatedFields: Object.keys(dto),
      },
    });

    // If transitioned to ASSIGNED, notify the first process technician
    if (isTransitioningToAssigned) {
      const sorted = [...updated.processes].sort(
        (a, b) => a.sequence - b.sequence,
      );
      const firstProcess = sorted[0];

      if (firstProcess && firstProcess.technicianId) {
        await this.notificationsService.create({
          tenantId,
          userId: firstProcess.technicianId,
          title: 'New Work Order Assigned',
          message: `You have been assigned to "${firstProcess.processName}" for work order ${updated.folioNumber} (Patient: ${updated.patient})${updated.boxNumber ? ` (Box: ${updated.boxNumber})` : ''}.`,
          type: 'WORK_ORDER',
          referenceId: updated.id,
        });

        await this.auditLogsService.log({
          tenantId,
          userId,
          action: 'NOTIFICATION_TRIGGERED',
          entityName: 'NOTIFICATION',
          entityId: updated.id,
          details: {
            userId: firstProcess.technicianId,
            title: 'New Work Order Assigned',
          },
        });
      } else if (
        firstProcess &&
        firstProcess.isVerification &&
        !firstProcess.technicianId
      ) {
        // Auto-start External Verification
        const now = new Date();
        await this.prisma.workOrderProcess.update({
          where: { id: firstProcess.id },
          data: {
            status: ProcessStatus.IN_PROGRESS,
            startedAt: now,
            activityLogs: {
              create: {
                action: ProcessActivityAction.START,
                timestamp: now,
                notes: 'External verification started automatically',
              },
            },
          },
        });

        await this.auditLogsService.log({
          tenantId,
          userId,
          action: 'VERIFICATION_START',
          entityName: 'PROCESS',
          entityId: firstProcess.id,
          details: {
            workOrderId: updated.id,
            processName: firstProcess.processName,
            type: 'EXTERNAL',
            notes: 'Started automatically on assignment',
          },
        });

        await this.updateWorkOrderStatus(updated.id);
      }

      await this.auditLogsService.log({
        tenantId,
        userId,
        action: 'ASSIGN',
        entityName: 'WORK_ORDER',
        entityId: updated.id,
        details: {
          folioNumber: updated.folioNumber,
          assignedStepsCount: sorted.length,
        },
      });
    }

    this.logger.log(
      `Work order updated: ${updated.folioNumber} (${updated.id})`,
    );

    if (updated.branchId) {
      this.websocketsGateway.sendToBranch(tenantId, updated.branchId, 'work_order_updated', {
        id: updated.id,
        folioNumber: updated.folioNumber,
        patient: updated.patient,
        status: updated.status,
      });
    }

    return this.findOne(tenantId, id, branchIdContext);
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

  private async updateWorkOrderStatus(workOrderId: string) {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        processes: true,
      },
    });

    if (!workOrder) return;

    const status = this.calculateWorkOrderStatus(workOrder.processes);

    const updated = await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: { status },
    });

    if (updated.branchId) {
      this.websocketsGateway.sendToBranch(updated.tenantId, updated.branchId, 'work_order_updated', {
        id: updated.id,
        folioNumber: updated.folioNumber,
        patient: updated.patient,
        status: updated.status,
      });
    }
  }

  /**
   * Fetch branch-scoped operational dashboard statistics for admins.
   */
  async getDashboardStats(tenantId: string, branchIdContext: string | null) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Fetch Verification Alerts (active/pending verification steps in the branch)
    const alerts = await this.prisma.workOrderProcess.findMany({
      where: {
        isVerification: true,
        status: { in: [ProcessStatus.NOT_STARTED, ProcessStatus.IN_PROGRESS] },
        workOrder: {
          tenantId,
          ...(branchIdContext && { branchId: branchIdContext }),
        },
      },
      include: {
        workOrder: {
          select: {
            id: true,
            folioNumber: true,
            patient: true,
            status: true,
            doctor: { select: { name: true } },
            branch: { select: { id: true, name: true, defaultAdminId: true } },
            processes: {
              orderBy: { sequence: 'asc' },
              select: { sequence: true, status: true },
            },
          },
        },
        technician: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const readyAlerts = alerts.filter((a) => {
      if (a.status === ProcessStatus.IN_PROGRESS) return true;
      const sortedProcs = a.workOrder.processes || [];
      const preceding = sortedProcs.filter((p) => p.sequence < a.sequence);
      return preceding.every((p) => p.status === ProcessStatus.COMPLETED);
    });

    const verificationAlerts = readyAlerts.map((a) => ({
      id: a.id,
      workOrderId: a.workOrderId,
      folioNumber: a.workOrder.folioNumber,
      patient: a.workOrder.patient,
      processName: a.processName,
      isVerification: true,
      type: a.technicianId ? 'INTERNAL' : 'EXTERNAL',
      status: a.status,
      startedAt: a.startedAt,
      assignedTo:
        a.technicianId && a.technician
          ? `${a.technician.firstName} ${a.technician.lastName}`
          : a.workOrder.doctor
            ? a.workOrder.doctor.name
            : 'Doctor',
      defaultAdminId: a.workOrder.branch?.defaultAdminId || null,
    }));

    // 2. Fetch WO Status counts
    const woCounts = await this.prisma.workOrder.groupBy({
      by: ['status'],
      where: {
        tenantId,
        ...(branchIdContext && { branchId: branchIdContext }),
      },
      _count: {
        id: true,
      },
    });

    const woStatusSummary = {
      CREATED: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      INTERNAL_VERIFICATION: 0,
      EXTERNAL_VERIFICATION: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0,
    };

    woCounts.forEach((c) => {
      woStatusSummary[c.status] = c._count.id;
    });

    // 3. Fetch Pending Processes (Ready steps not started)
    const allPendingProcesses = await this.prisma.workOrderProcess.findMany({
      where: {
        status: ProcessStatus.NOT_STARTED,
        isVerification: false,
        workOrder: {
          tenantId,
          status: {
            in: [WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS],
          },
          ...(branchIdContext && { branchId: branchIdContext }),
        },
      },
      include: {
        workOrder: {
          select: {
            folioNumber: true,
            patient: true,
            processes: {
              orderBy: { sequence: 'asc' },
              select: { sequence: true, status: true },
            },
          },
        },
        technician: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    const readyPending = allPendingProcesses.filter((p) => {
      if (p.sequence === 0) return true;
      const sortedProcs = p.workOrder.processes;
      const prev = sortedProcs.find((sp) => sp.sequence === p.sequence - 1);
      return prev && prev.status === ProcessStatus.COMPLETED;
    });

    const pendingProcesses = readyPending.map((p) => ({
      id: p.id,
      workOrderId: p.workOrderId,
      folioNumber: p.workOrder.folioNumber,
      patient: p.workOrder.patient,
      processName: p.processName,
      technicianName: p.technician
        ? `${p.technician.firstName} ${p.technician.lastName}`
        : 'Unassigned',
    }));

    // 4. In Progress WO count
    const inProgressWorkOrders = await this.prisma.workOrder.count({
      where: {
        tenantId,
        status: {
          in: [
            WorkOrderStatus.IN_PROGRESS,
            WorkOrderStatus.INTERNAL_VERIFICATION,
            WorkOrderStatus.EXTERNAL_VERIFICATION,
          ],
        },
        ...(branchIdContext && { branchId: branchIdContext }),
      },
    });

    // 5. Completed WO count today
    const completedWorkOrders = await this.prisma.workOrder.count({
      where: {
        tenantId,
        status: WorkOrderStatus.COMPLETED,
        updatedAt: { gte: startOfToday },
        ...(branchIdContext && { branchId: branchIdContext }),
      },
    });

    // 6. Technician Activity Overview
    const techniciansInBranch = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: UserRole.TECHNICIAN,
        status: 'ACTIVE',
        ...(branchIdContext && { branchId: branchIdContext }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        assignedWoProcesses: {
          where: {
            workOrder: { tenantId },
          },
          include: {
            workOrder: { select: { folioNumber: true } },
          },
        },
      },
    });

    const technicianActivityOverview = techniciansInBranch.map((tech) => {
      const activeStep = tech.assignedWoProcesses.find(
        (p) =>
          p.status === ProcessStatus.IN_PROGRESS ||
          p.status === ProcessStatus.PAUSED,
      );
      const completedToday = tech.assignedWoProcesses.filter(
        (p) =>
          p.status === ProcessStatus.COMPLETED &&
          p.endedAt &&
          p.endedAt >= startOfToday,
      ).length;

      return {
        id: tech.id,
        name: `${tech.firstName} ${tech.lastName}`,
        activeStep: activeStep
          ? `${activeStep.processName} (${activeStep.workOrder.folioNumber})`
          : 'Idle',
        completedToday,
      };
    });

    // Fetch In-Progress Work Orders list
    const inProgressWOs = await this.prisma.workOrder.findMany({
      where: {
        tenantId,
        status: WorkOrderStatus.IN_PROGRESS,
        ...(branchIdContext && { branchId: branchIdContext }),
      },
      include: {
        doctor: { select: { id: true, name: true } },
        prosthesisType: { select: { id: true, name: true } },
        processes: {
          orderBy: { sequence: 'asc' },
          include: {
            technician: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Fetch Verification Work Orders list
    const verificationWOs = await this.prisma.workOrder.findMany({
      where: {
        tenantId,
        status: {
          in: [
            WorkOrderStatus.INTERNAL_VERIFICATION,
            WorkOrderStatus.EXTERNAL_VERIFICATION,
          ],
        },
        ...(branchIdContext && { branchId: branchIdContext }),
      },
      include: {
        doctor: { select: { id: true, name: true } },
        prosthesisType: { select: { id: true, name: true } },
        branch: {
          select: { id: true, name: true, code: true, defaultAdminId: true },
        },
        processes: {
          orderBy: { sequence: 'asc' },
          include: {
            technician: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      verificationAlerts,
      woStatusSummary,
      pendingProcesses,
      inProgressWorkOrders,
      completedWorkOrders,
      technicianActivityOverview,
      inProgressWOs,
      verificationWOs,
    };
  }

  /**
   * Start a verification process.
   */
  async startVerification(
    tenantId: string,
    workOrderId: string,
    processId: string,
    userId: string,
  ) {
    const process = await this.prisma.workOrderProcess.findFirst({
      where: { id: processId, workOrderId },
      include: { workOrder: true },
    });

    if (!process || process.workOrder.tenantId !== tenantId) {
      throw new NotFoundException('Verification step not found.');
    }

    if (!process.isVerification) {
      throw new BadRequestException(
        'This process step is not a verification step.',
      );
    }

    if (process.status !== ProcessStatus.NOT_STARTED) {
      throw new BadRequestException(
        `Verification has already been started or completed.`,
      );
    }

    // Verify sequence: previous steps completed
    const precedingProcesses = await this.prisma.workOrderProcess.findMany({
      where: {
        workOrderId,
        sequence: { lt: process.sequence },
      },
    });

    if (precedingProcesses.some((p) => p.status !== ProcessStatus.COMPLETED)) {
      throw new BadRequestException(
        'Cannot start verification: previous process steps are not completed.',
      );
    }

    const now = new Date();
    const updated = await this.prisma.workOrderProcess.update({
      where: { id: processId },
      data: {
        status: ProcessStatus.IN_PROGRESS,
        startedAt: now,
        activityLogs: {
          create: {
            action: ProcessActivityAction.START,
            timestamp: now,
            notes: 'Verification started by administrator',
          },
        },
      },
    });

    await this.updateWorkOrderStatus(workOrderId);

    // Audit log
    await this.auditLogsService.log({
      tenantId,
      userId,
      action: 'VERIFICATION_START',
      entityName: 'PROCESS',
      entityId: processId,
      details: {
        workOrderId,
        processName: process.processName,
        type: process.technicianId ? 'INTERNAL' : 'EXTERNAL',
      },
    });

    return updated;
  }

  /**
   * End a verification process with outcome (SUCCESS / REWORK).
   */
  async endVerification(
    tenantId: string,
    workOrderId: string,
    processId: string,
    outcome: 'SUCCESS' | 'REWORK' | 'REPETITION',
    userId: string,
  ) {
    const process = await this.prisma.workOrderProcess.findFirst({
      where: { id: processId, workOrderId },
      include: { workOrder: true },
    });

    if (!process || process.workOrder.tenantId !== tenantId) {
      throw new NotFoundException('Verification step not found.');
    }

    if (!process.isVerification) {
      throw new BadRequestException(
        'This process step is not a verification step.',
      );
    }

    if (process.isVerification && !process.technicianId) {
      if (!process.workOrder.branchId) {
        throw new BadRequestException(
          'Work order is not assigned to a branch.',
        );
      }
      const branch = await this.prisma.branch.findUnique({
        where: { id: process.workOrder.branchId },
      });
      if (!branch || branch.defaultAdminId !== userId) {
        throw new BadRequestException(
          "Only the branch's Default Admin can complete this External Verification process.",
        );
      }
    }

    if (
      process.status !== ProcessStatus.IN_PROGRESS &&
      process.status !== ProcessStatus.PAUSED
    ) {
      throw new BadRequestException('Verification is not active.');
    }

    const now = new Date();
    const startedAt = process.startedAt || now;
    const totalActive = Math.max(
      0,
      Math.round((now.getTime() - startedAt.getTime()) / 1000),
    );

    const updated = await this.prisma.workOrderProcess.update({
      where: { id: processId },
      data: {
        status:
          outcome === 'REWORK'
            ? ProcessStatus.IN_PROGRESS
            : ProcessStatus.COMPLETED,
        endedAt: outcome === 'REWORK' ? null : now,
        totalActiveDuration: outcome === 'REWORK' ? undefined : totalActive,
        verificationStatus: outcome,
        activityLogs: {
          create: {
            action:
              outcome === 'REWORK'
                ? ProcessActivityAction.PAUSE
                : ProcessActivityAction.END,
            timestamp: now,
            notes:
              outcome === 'REWORK'
                ? `Verification flagged for rework, pending step assignment.`
                : `Verification ended with outcome ${outcome}. Duration: ${Math.round(totalActive / 60)} minutes.`,
          },
        },
      },
    });

    // Write Audit Log
    await this.auditLogsService.log({
      tenantId,
      userId,
      action: 'VERIFICATION_END',
      entityName: 'PROCESS',
      entityId: processId,
      details: {
        workOrderId,
        processName: process.processName,
        outcome,
        durationSeconds: totalActive,
      },
    });

    if (outcome === 'REPETITION') {
      const allProcs = await this.prisma.workOrderProcess.findMany({
        where: { workOrderId },
        orderBy: { sequence: 'asc' },
      });

      // Track completed steps (excluding the triggering verification itself) before resetting
      const completedProcs = allProcs.filter(
        (p) => p.status === ProcessStatus.COMPLETED && p.id !== processId,
      );
      const completedStepsStr = completedProcs
        .map((p) => p.processName)
        .join(', ');

      // 1. Reset all processes to NOT_STARTED, clear dates and tracking flags
      for (const p of allProcs) {
        await this.prisma.workOrderProcess.update({
          where: { id: p.id },
          data: {
            status: ProcessStatus.NOT_STARTED,
            startedAt: null,
            endedAt: null,
            verificationStatus: null,
            lastPausedAt: null,
            pauseCount: 0,
            totalPauseDuration: 0,
            totalActiveDuration: 0,
            reworkActive: false,
          },
        });

        // Log repetition reset for each completed process step (excluding the triggering verification itself)
        if (p.id !== processId && p.status === ProcessStatus.COMPLETED) {
          await this.auditLogsService.log({
            tenantId,
            userId,
            action: 'PROCESS_REPETITION_RESET',
            entityName: 'PROCESS',
            entityId: p.id,
            details: {
              processName: p.processName,
              previousStatus: 'COMPLETED',
              updatedStatus: 'REPETITION',
              status: 'REPETITION',
            },
          });
        }
      }

      // 2. Increment repetitionCount on the WorkOrder
      const updatedWO = await this.prisma.workOrder.update({
        where: { id: workOrderId },
        data: {
          repetitionCount: { increment: 1 },
        },
      });

      // Write repetition log to database
      await this.prisma.repetitionLog.create({
        data: {
          workOrderId,
          repetitionCount: updatedWO.repetitionCount,
          initiatedById: userId,
          verificationStage: process.processName,
          completedSteps: completedStepsStr || 'None',
        },
      });

      // 3. Notify first process's technician
      const firstProcess = allProcs[0];
      if (firstProcess && firstProcess.technicianId) {
        await this.notificationsService.create({
          tenantId,
          userId: firstProcess.technicianId,
          title: 'Work Order Repetition Triggered',
          message: `Work Order "${process.workOrder.folioNumber}" has been restarted due to a repetition request from verification step "${process.processName}". Please restart step "${firstProcess.processName}".`,
          type: 'WORK_ORDER',
          referenceId: workOrderId,
        });

        await this.auditLogsService.log({
          tenantId,
          userId,
          action: 'NOTIFICATION_TRIGGERED',
          entityName: 'NOTIFICATION',
          entityId: workOrderId,
          details: {
            userId: firstProcess.technicianId,
            title: 'Work Order Repetition Triggered',
          },
        });
      }

      // 4. Log overall repetition event
      await this.auditLogsService.log({
        tenantId,
        userId,
        action: 'REPETITION_TRIGGERED',
        entityName: 'WORK_ORDER',
        entityId: workOrderId,
        details: {
          initiatedBy: userId,
          verificationStage: process.processName,
          repetitionCount: updatedWO.repetitionCount,
          affectedCompletedProcesses: completedProcs.map((p) => p.processName),
        },
      });
    }

    if (outcome === 'SUCCESS') {
      // Find preceding processes with active rework flags
      const activeReworks = await this.prisma.workOrderProcess.findMany({
        where: {
          workOrderId,
          reworkActive: true,
        },
      });

      if (activeReworks.length > 0) {
        await this.prisma.workOrderProcess.updateMany({
          where: {
            id: { in: activeReworks.map((p) => p.id) },
          },
          data: {
            reworkActive: false,
          },
        });

        await this.prisma.reworkLog.updateMany({
          where: {
            workOrderId,
            processName: { in: activeReworks.map((p) => p.processName) },
            approvedAt: null,
          },
          data: {
            status: 'Approved',
            approvedAt: now,
          },
        });

        await this.auditLogsService.log({
          tenantId,
          userId,
          action: 'REWORK_COMPLETED',
          entityName: 'WORK_ORDER',
          entityId: workOrderId,
          details: {
            clearedProcesses: activeReworks.map((p) => p.processName),
            completedAtVerificationStep: process.processName,
          },
        });
      }

      // Find and activate next step
      const nextProcess = await this.prisma.workOrderProcess.findFirst({
        where: {
          workOrderId,
          sequence: { gt: process.sequence },
        },
        orderBy: { sequence: 'asc' },
      });

      if (nextProcess) {
        if (nextProcess.isVerification) {
          if (!nextProcess.technicianId) {
            // Auto-start External Verification
            const autoStartNow = new Date();
            await this.prisma.workOrderProcess.update({
              where: { id: nextProcess.id },
              data: {
                status: ProcessStatus.IN_PROGRESS,
                startedAt: autoStartNow,
                activityLogs: {
                  create: {
                    action: ProcessActivityAction.START,
                    timestamp: autoStartNow,
                    notes: 'External verification started automatically',
                  },
                },
              },
            });

            await this.auditLogsService.log({
              tenantId,
              userId,
              action: 'VERIFICATION_START',
              entityName: 'PROCESS',
              entityId: nextProcess.id,
              details: {
                workOrderId,
                processName: nextProcess.processName,
                type: 'EXTERNAL',
                notes: 'Started automatically after previous step completion',
              },
            });
          }

          // Send verification pending alerts to admins
          const branchAdmins = await this.prisma.user.findMany({
            where: {
              tenantId,
              branchId: process.workOrder.branchId,
              role: UserRole.ADMIN,
              status: 'ACTIVE',
            },
          });

          for (const admin of branchAdmins) {
            await this.notificationsService.create({
              tenantId,
              userId: admin.id,
              title: 'Verification Pending Alert',
              message: `Work Order "${process.workOrder.folioNumber}"${process.workOrder.boxNumber ? ` (Box: ${process.workOrder.boxNumber})` : ''} requires verification step "${nextProcess.processName}".`,
              type: 'VERIFICATION_PENDING',
              referenceId: workOrderId,
            });

            await this.auditLogsService.log({
              tenantId,
              action: 'NOTIFICATION_TRIGGERED',
              entityName: 'NOTIFICATION',
              entityId: workOrderId,
              details: {
                userId: admin.id,
                title: 'Verification Pending Alert',
              },
            });
          }
        } else if (nextProcess.technicianId) {
          // Notify next technician
          await this.notificationsService.create({
            tenantId,
            userId: nextProcess.technicianId,
            title: 'New Active Work Order Step',
            message: `Work Order "${process.workOrder.folioNumber}"${process.workOrder.boxNumber ? ` (Box: ${process.workOrder.boxNumber})` : ''} is ready for you. The previous verification step has been completed.`,
            type: 'WORK_ORDER',
            referenceId: workOrderId,
          });

          await this.auditLogsService.log({
            tenantId,
            action: 'NOTIFICATION_TRIGGERED',
            entityName: 'NOTIFICATION',
            entityId: workOrderId,
            details: {
              userId: nextProcess.technicianId,
              title: 'New Active Work Order Step',
            },
          });
        }
      } else {
        // No more steps -> Mark WO as completed!
        const branchAdmins = await this.prisma.user.findMany({
          where: {
            tenantId,
            branchId: process.workOrder.branchId,
            role: UserRole.ADMIN,
            status: 'ACTIVE',
          },
        });

        for (const admin of branchAdmins) {
          await this.notificationsService.create({
            tenantId,
            userId: admin.id,
            title: 'Work Order Completed',
            message: `Work Order "${process.workOrder.folioNumber}"${process.workOrder.boxNumber ? ` (Box: ${process.workOrder.boxNumber})` : ''} has been fully completed!`,
            type: 'WORK_ORDER_COMPLETED',
            referenceId: workOrderId,
          });

          await this.auditLogsService.log({
            tenantId,
            action: 'NOTIFICATION_TRIGGERED',
            entityName: 'NOTIFICATION',
            entityId: workOrderId,
            details: {
              userId: admin.id,
              title: 'Work Order Completed',
            },
          });
        }
      }
    }

    await this.updateWorkOrderStatus(workOrderId);
    return updated;
  }
}
