import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ProcessStatus, WorkOrderStatus, ProcessActivityAction, UserRole } from '@prisma/client';

@Injectable()
export class TechnicianPortalService {
  private readonly logger = new Logger(TechnicianPortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Scans and aggregates queue metrics for the logged-in technician.
   */
  async getDashboardStats(tenantId: string, technicianId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [pendingCount, activeCount, pausedCount, completedTodayCount] = await Promise.all([
      this.prisma.workOrderProcess.count({
        where: {
          technicianId,
          status: ProcessStatus.NOT_STARTED,
          workOrder: { tenantId },
        },
      }),
      this.prisma.workOrderProcess.count({
        where: {
          technicianId,
          status: ProcessStatus.IN_PROGRESS,
          workOrder: { tenantId },
        },
      }),
      this.prisma.workOrderProcess.count({
        where: {
          technicianId,
          status: ProcessStatus.PAUSED,
          workOrder: { tenantId },
        },
      }),
      this.prisma.workOrderProcess.count({
        where: {
          technicianId,
          status: ProcessStatus.COMPLETED,
          endedAt: { gte: startOfToday },
          workOrder: { tenantId },
        },
      }),
    ]);

    return {
      pendingCount,
      activeCount,
      pausedCount,
      completedTodayCount,
    };
  }

  /**
   * Fetches work orders where this technician has assigned steps, applying filter context.
   */
  async getAssignedWorkOrders(tenantId: string, userId: string, statusFilter?: string) {
    const whereClause: any = {
      tenantId,
      processes: {
        some: {
          technicianId: userId,
        },
      },
    };

    if (statusFilter && statusFilter !== 'ALL') {
      if (statusFilter === 'PENDING') {
        whereClause.processes = {
          some: {
            technicianId: userId,
            status: ProcessStatus.NOT_STARTED,
          },
        };
      } else if (statusFilter === 'IN_PROGRESS') {
        whereClause.processes = {
          some: {
            technicianId: userId,
            status: { in: [ProcessStatus.IN_PROGRESS, ProcessStatus.PAUSED] },
          },
        };
      } else if (statusFilter === 'COMPLETED') {
        whereClause.processes = {
          some: {
            technicianId: userId,
            status: ProcessStatus.COMPLETED,
          },
        };
      }
    }

    return this.prisma.workOrder.findMany({
      where: whereClause,
      include: {
        doctor: { select: { id: true, name: true, clinicName: true } },
        prosthesisType: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
        processes: {
          orderBy: { sequence: 'asc' },
          include: {
            technician: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Fetches details of a specific work order if the technician is assigned to a process in it.
   */
  async getWorkOrderDetail(tenantId: string, userId: string, id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        id,
        tenantId,
        processes: {
          some: { technicianId: userId },
        },
      },
      include: {
        doctor: { select: { id: true, name: true, clinicName: true } },
        prosthesisType: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
        processes: {
          orderBy: { sequence: 'asc' },
          include: {
            technician: { select: { id: true, firstName: true, lastName: true, email: true } },
            activityLogs: { orderBy: { timestamp: 'desc' } },
          },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work order with ID "${id}" not found or unauthorized.`);
    }

    return workOrder;
  }

  /**
   * Helper to retrieve a process step and verify it belongs to the user and tenant.
   */
  private async getVerifiedProcess(tenantId: string, userId: string, processId: string) {
    const process = await this.prisma.workOrderProcess.findUnique({
      where: { id: processId },
      include: {
        workOrder: true,
      },
    });

    if (!process || process.workOrder.tenantId !== tenantId) {
      throw new NotFoundException(`Process step with ID "${processId}" not found.`);
    }

    if (process.technicianId !== userId) {
      throw new BadRequestException('You are not assigned to this process step.');
    }

    return process;
  }

  /**
   * Start a process step.
   */
  async startProcess(tenantId: string, userId: string, processId: string) {
    const process = await this.getVerifiedProcess(tenantId, userId, processId);

    if (process.status !== ProcessStatus.NOT_STARTED) {
      throw new BadRequestException(`Cannot start process: current status is ${process.status}.`);
    }

    // Strict sequential execution check
    const precedingProcesses = await this.prisma.workOrderProcess.findMany({
      where: {
        workOrderId: process.workOrderId,
        sequence: { lt: process.sequence },
      },
    });

    if (precedingProcesses.some((p) => p.status !== ProcessStatus.COMPLETED)) {
      throw new BadRequestException('Cannot start process: previous process steps are not completed yet.');
    }

    // Prevent duplicate active process execution
    const activeProcesses = await this.prisma.workOrderProcess.findMany({
      where: {
        workOrderId: process.workOrderId,
        status: { in: [ProcessStatus.IN_PROGRESS, ProcessStatus.PAUSED] },
      },
    });

    if (activeProcesses.length > 0) {
      throw new BadRequestException(
        'Cannot start process: another step in this work order is already active or paused.',
      );
    }

    const now = new Date();

    const updatedProcess = await this.prisma.workOrderProcess.update({
      where: { id: processId },
      data: {
        status: ProcessStatus.IN_PROGRESS,
        startedAt: now,
        activityLogs: {
          create: {
            action: ProcessActivityAction.START,
            timestamp: now,
            notes: 'Process started by technician',
          },
        },
      },
      include: {
        activityLogs: { orderBy: { timestamp: 'desc' } },
      },
    });

    await this.updateWorkOrderStatus(process.workOrderId);

    // Write Audit Log
    await this.auditLogsService.log({
      tenantId,
      userId,
      action: 'PROCESS_START',
      entityName: 'PROCESS',
      entityId: process.id,
      details: {
        workOrderId: process.workOrderId,
        processName: process.processName,
      },
    });

    this.logger.log(`Process ${processId} started by technician ${userId}`);
    return updatedProcess;
  }

  /**
   * Pause an in-progress process step.
   */
  async pauseProcess(tenantId: string, userId: string, processId: string) {
    const process = await this.getVerifiedProcess(tenantId, userId, processId);

    if (process.status !== ProcessStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot pause process: process is not in progress.');
    }

    const now = new Date();

    const updatedProcess = await this.prisma.workOrderProcess.update({
      where: { id: processId },
      data: {
        status: ProcessStatus.PAUSED,
        lastPausedAt: now,
        pauseCount: { increment: 1 },
        activityLogs: {
          create: {
            action: ProcessActivityAction.PAUSE,
            timestamp: now,
            notes: 'Process paused by technician',
          },
        },
      },
      include: {
        activityLogs: { orderBy: { timestamp: 'desc' } },
      },
    });

    await this.updateWorkOrderStatus(process.workOrderId);

    // Write Audit Log
    await this.auditLogsService.log({
      tenantId,
      userId,
      action: 'PROCESS_PAUSE',
      entityName: 'PROCESS',
      entityId: process.id,
      details: {
        workOrderId: process.workOrderId,
        processName: process.processName,
      },
    });

    this.logger.log(`Process ${processId} paused by technician ${userId}`);
    return updatedProcess;
  }

  /**
   * Resume a paused process step.
   */
  async resumeProcess(tenantId: string, userId: string, processId: string) {
    const process = await this.getVerifiedProcess(tenantId, userId, processId);

    if (process.status !== ProcessStatus.PAUSED) {
      throw new BadRequestException('Cannot resume process: process is not paused.');
    }

    const now = new Date();
    const lastPaused = process.lastPausedAt || now;
    const pauseDuration = Math.round((now.getTime() - lastPaused.getTime()) / 1000);

    const updatedProcess = await this.prisma.workOrderProcess.update({
      where: { id: processId },
      data: {
        status: ProcessStatus.IN_PROGRESS,
        totalPauseDuration: { increment: pauseDuration },
        lastPausedAt: null,
        activityLogs: {
          create: {
            action: ProcessActivityAction.RESUME,
            timestamp: now,
            notes: `Process resumed by technician (paused for ${pauseDuration}s)`,
          },
        },
      },
      include: {
        activityLogs: { orderBy: { timestamp: 'desc' } },
      },
    });

    await this.updateWorkOrderStatus(process.workOrderId);

    // Write Audit Log
    await this.auditLogsService.log({
      tenantId,
      userId,
      action: 'PROCESS_RESUME',
      entityName: 'PROCESS',
      entityId: process.id,
      details: {
        workOrderId: process.workOrderId,
        processName: process.processName,
        pauseDuration,
      },
    });

    this.logger.log(`Process ${processId} resumed by technician ${userId}`);
    return updatedProcess;
  }

  /**
   * End a process step.
   */
  async endProcess(tenantId: string, userId: string, processId: string) {
    const process = await this.getVerifiedProcess(tenantId, userId, processId);

    if (
      process.status !== ProcessStatus.IN_PROGRESS &&
      process.status !== ProcessStatus.PAUSED
    ) {
      throw new BadRequestException('Cannot end process: process is not active.');
    }

    const now = new Date();
    let totalPause = process.totalPauseDuration;

    if (process.status === ProcessStatus.PAUSED && process.lastPausedAt) {
      const pauseDuration = Math.round((now.getTime() - process.lastPausedAt.getTime()) / 1000);
      totalPause += pauseDuration;
    }

    const startedAt = process.startedAt || now;
    const totalTime = Math.round((now.getTime() - startedAt.getTime()) / 1000);
    const totalActive = Math.max(0, totalTime - totalPause);

    const updatedProcess = await this.prisma.workOrderProcess.update({
      where: { id: processId },
      data: {
        status: ProcessStatus.COMPLETED,
        endedAt: now,
        totalPauseDuration: totalPause,
        totalActiveDuration: totalActive,
        lastPausedAt: null,
        activityLogs: {
          create: {
            action: ProcessActivityAction.END,
            timestamp: now,
            notes: `Process completed. Active time: ${Math.round(totalActive / 60)} minutes.`,
          },
        },
      },
      include: {
        activityLogs: { orderBy: { timestamp: 'desc' } },
      },
    });

    // Write Audit Log
    await this.auditLogsService.log({
      tenantId,
      userId,
      action: 'PROCESS_END',
      entityName: 'PROCESS',
      entityId: process.id,
      details: {
        workOrderId: process.workOrderId,
        processName: process.processName,
        totalActiveDuration: totalActive,
        totalPauseDuration: totalPause,
      },
    });

    // Automatically enable next process step and alert next technician/admin
    const nextProcess = await this.prisma.workOrderProcess.findFirst({
      where: {
        workOrderId: process.workOrderId,
        sequence: { gt: process.sequence },
      },
      orderBy: { sequence: 'asc' },
    });

    if (nextProcess) {
      if (nextProcess.isVerification) {
        // Verification step reached! Notify all branch admins of the tenant
        const wo = await this.prisma.workOrder.findUnique({
          where: { id: process.workOrderId },
          select: { branchId: true, folioNumber: true },
        });

        if (wo) {
          const branchAdmins = await this.prisma.user.findMany({
            where: {
              tenantId,
              branchId: wo.branchId,
              role: UserRole.ADMIN,
              status: 'ACTIVE',
            },
          });

          for (const admin of branchAdmins) {
            await this.notificationsService.create({
              tenantId,
              userId: admin.id,
              title: 'Verification Pending Alert',
              message: `Work Order "${wo.folioNumber}" requires verification step "${nextProcess.processName}".`,
              type: 'VERIFICATION_PENDING',
              referenceId: process.workOrderId,
            });

            await this.auditLogsService.log({
              tenantId,
              action: 'NOTIFICATION_TRIGGERED',
              entityName: 'NOTIFICATION',
              entityId: process.workOrderId,
              details: {
                userId: admin.id,
                title: 'Verification Pending Alert',
              },
            });
          }
        }
      } else if (nextProcess.technicianId) {
        // Normal technician process
        await this.notificationsService.create({
          tenantId,
          userId: nextProcess.technicianId,
          title: 'New Active Work Order Step',
          message: `Work Order "${process.workOrder.folioNumber}" is ready for you. The previous step "${process.processName}" has been completed.`,
          type: 'WORK_ORDER',
          referenceId: process.workOrderId,
        });

        await this.auditLogsService.log({
          tenantId,
          action: 'NOTIFICATION_TRIGGERED',
          entityName: 'NOTIFICATION',
          entityId: process.workOrderId,
          details: {
            userId: nextProcess.technicianId,
            title: 'New Active Work Order Step',
          },
        });
      }
    } else {
      // Work order has no more steps, so it is fully completed!
      const wo = await this.prisma.workOrder.findUnique({
        where: { id: process.workOrderId },
        select: { branchId: true, folioNumber: true },
      });

      if (wo) {
        const branchAdmins = await this.prisma.user.findMany({
          where: {
            tenantId,
            branchId: wo.branchId,
            role: UserRole.ADMIN,
            status: 'ACTIVE',
          },
        });

        for (const admin of branchAdmins) {
          await this.notificationsService.create({
            tenantId,
            userId: admin.id,
            title: 'Work Order Completed',
            message: `Work Order "${wo.folioNumber}" has been fully completed!`,
            type: 'WORK_ORDER_COMPLETED',
            referenceId: process.workOrderId,
          });

          await this.auditLogsService.log({
            tenantId,
            action: 'NOTIFICATION_TRIGGERED',
            entityName: 'NOTIFICATION',
            entityId: process.workOrderId,
            details: {
              userId: admin.id,
              title: 'Work Order Completed',
            },
          });
        }
      }
    }

    await this.updateWorkOrderStatus(process.workOrderId);

    this.logger.log(`Process ${processId} ended by technician ${userId}`);
    return updatedProcess;
  }

  /**
   * Recalculates and updates the overall work order status.
   */
  private async updateWorkOrderStatus(workOrderId: string) {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        processes: true,
      },
    });

    if (!workOrder) return;

    // Helper calculate status logic
    const status = this.calculateWorkOrderStatus(workOrder.processes);

    await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: { status },
    });
  }

  private calculateWorkOrderStatus(
    processes: { isVerification: boolean; technicianId: string | null; status: ProcessStatus }[]
  ): WorkOrderStatus {
    if (processes.length === 0) {
      return WorkOrderStatus.CREATED;
    }

    if (processes.some((p) => p.status === ProcessStatus.FAILED)) {
      return WorkOrderStatus.FAILED;
    }

    if (processes.some((p) => p.status === ProcessStatus.CANCELLED)) {
      return WorkOrderStatus.CANCELLED;
    }

    if (processes.every((p) => p.status === ProcessStatus.COMPLETED)) {
      return WorkOrderStatus.COMPLETED;
    }

    const inProgressProc = processes.find(
      (p) => p.status === ProcessStatus.IN_PROGRESS || p.status === ProcessStatus.PAUSED
    );
    if (inProgressProc) {
      if (inProgressProc.isVerification) {
        return inProgressProc.technicianId
          ? WorkOrderStatus.INTERNAL_VERIFICATION
          : WorkOrderStatus.EXTERNAL_VERIFICATION;
      }
      return WorkOrderStatus.IN_PROGRESS;
    }

    const allNotStarted = processes.every((p) => p.status === ProcessStatus.NOT_STARTED);
    if (allNotStarted) {
      const hasAnyTechnician = processes.some((p) => p.technicianId !== null);
      return hasAnyTechnician ? WorkOrderStatus.ASSIGNED : WorkOrderStatus.CREATED;
    }

    return WorkOrderStatus.IN_PROGRESS;
  }

  /**
   * Securely update notes for a work order assigned to a technician.
   */
  async updateWorkOrderNotes(tenantId: string, userId: string, id: string, notes: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        id,
        tenantId,
        processes: {
          some: { technicianId: userId },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work order with ID "${id}" not found or unauthorized.`);
    }

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: { notes },
    });

    await this.auditLogsService.log({
      tenantId,
      userId,
      action: 'TECHNICIAN_UPDATE_NOTES',
      entityName: 'WORK_ORDER',
      entityId: id,
      details: {
        notes,
      },
    });

    return { success: true, notes: updated.notes };
  }
}
