import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { generateFolioNumber } from '../../common/utils/folio.util';
import { NotificationsService } from '../notifications/notifications.service';
import { WebsocketsGateway } from '../websockets/websockets.gateway';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MailService } from '../mail/mail.service';
import {
  ProcessStatus,
  WorkOrderStatus,
  ProcessActivityAction,
  UserRole,
} from '@prisma/client';

import { CreateRequestedWorkOrderDto } from './dto';

@Injectable()
export class TechnicianPortalService {
  private readonly logger = new Logger(TechnicianPortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly websocketsGateway: WebsocketsGateway,
    private readonly mailService: MailService,
  ) {}

  /**
   * Triggers the external verification notification flow for a process step.
   * If the associated doctor is an integrated doctor, it notifies the clinic portal
   * and sends an email. It skips the internal admin notifications.
   * If the doctor is local, it runs the standard admin notifications and email.
   */
  async triggerExternalVerification(
    tenantId: string,
    workOrderId: string,
    processId: string,
    processName: string,
  ) {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        doctor: {
          include: {
            clinic: true,
          },
        },
        tenant: true,
      },
    });

    if (!workOrder) return;

    const doctor = workOrder.doctor;
    const isIntegrated = doctor && doctor.clinicId && doctor.clinic?.url;

    // 1. Send email notification to doctor's registered email address (applicable to both local and integrated)
    if (doctor && doctor.email) {
      await this.mailService.sendExternalVerificationPending(
        doctor.email,
        doctor.name,
        workOrder.patient,
        workOrder.folioNumber,
        processName,
        workOrder.tenant.name,
      );
    }

    if (isIntegrated) {
      // 2. For Integrated Doctors: Notify via Clinic Portal HTTP POST call
      const clinicUrl = doctor.clinic!.url;
      const notificationUrl = `${clinicUrl}/api/integration/notifications`;
      
      this.logger.log(`Notifying integrated clinic at ${notificationUrl} for WO ${workOrder.folioNumber}`);
      
      const apiKeyRecord = workOrder.branchId ? await this.prisma.apiKey.findFirst({
        where: {
          branchId: workOrder.branchId,
          isActive: true,
        },
      }) : null;
      const apiKey = apiKeyRecord ? apiKeyRecord.key : '';

      try {
        const response = await (global as any).fetch(notificationUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey && { 'X-API-Key': apiKey }),
          },
          body: JSON.stringify({
            event: 'EXTERNAL_VERIFICATION_REQUESTED',
            workOrderId: workOrder.id,
            folioNumber: workOrder.folioNumber,
            patient: workOrder.patient,
            processName: processName,
            doctor: {
              id: doctor.id,
              name: doctor.name,
              email: doctor.email,
            },
          }),
        });

        if (!response.ok) {
          this.logger.error(`Failed to notify clinic: ${response.status} - ${response.statusText}`);
        } else {
          this.logger.log(`Successfully notified clinic at ${notificationUrl}`);
        }
      } catch (err: any) {
        this.logger.error(`Error sending notification to clinic at ${notificationUrl}: ${err.message}`);
      }
    } else {
      // 3. For Local Doctors: Notify all active branch admins
      const branchAdmins = await this.prisma.user.findMany({
        where: {
          tenantId,
          branchId: workOrder.branchId,
          role: UserRole.ADMIN,
          status: 'ACTIVE',
        },
      });

      for (const admin of branchAdmins) {
        await this.notificationsService.create({
          tenantId,
          userId: admin.id,
          title: 'Verification Pending',
          message: `WO "${workOrder.folioNumber}"${workOrder.boxNumber ? ` (Box: ${workOrder.boxNumber})` : ''} requires verification "${processName}".`,
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
    }
  }


  /**
   * Scans and aggregates queue metrics for the logged-in technician.
   */
  async getDashboardStats(tenantId: string, technicianId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [pendingCount, activeCount, pausedCount, completedTodayCount] =
      await Promise.all([
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
  async getAssignedWorkOrders(
    tenantId: string,
    userId: string,
    statusFilter?: string,
  ) {
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
            technician: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Fetches work orders created by this technician.
   */
  async getCreatedWorkOrders(tenantId: string, userId: string) {
    return this.prisma.workOrder.findMany({
      where: {
        tenantId,
        createdById: userId,
      },
      include: {
        doctor: { select: { id: true, name: true, clinicName: true } },
        prosthesisType: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
        processes: {
          orderBy: { sequence: 'asc' },
          include: {
            technician: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Creates a new work order requested/created by a technician.
   */
  async createWorkOrder(
    tenantId: string,
    branchIdContext: string | null,
    userId: string,
    dto: CreateRequestedWorkOrderDto,
  ) {
    const {
      doctorId,
      patient,
      boxNumber,
      fileNumber,
      prosthesisTypeId,
      specification,
      color,
      notes,
    } = dto;

    if (!branchIdContext) {
      throw new BadRequestException('Branch context is required for technicians.');
    }

    // 1. Verify branch exists
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchIdContext, tenantId },
      select: { code: true },
    });
    if (!branch) {
      throw new NotFoundException(`Branch not found in your organization.`);
    }

    // 2. Verify doctor exists
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, tenantId },
    });
    if (!doctor) {
      throw new NotFoundException(`Doctor not found.`);
    }

    // 3. Verify prosthesis type exists
    const prosthesisType = await this.prisma.prosthesisType.findFirst({
      where: { id: prosthesisTypeId, tenantId },
    });
    if (!prosthesisType) {
      throw new NotFoundException(`Prosthesis type not found.`);
    }

    // 3.5. Load prosthesis type processes
    const assignments = await this.prisma.prosthesisTypeProcess.findMany({
      where: { prosthesisTypeId },
      include: {
        process: {
          select: {
            name: true,
            defaultTechnicianId: true,
          },
        },
      },
      orderBy: { sequence: 'asc' },
    });

    const mappedProcesses = assignments.map((assign) => ({
      processName: assign.process.name,
      technicianId: assign.process.defaultTechnicianId || null,
      sequence: assign.sequence,
      isVerification: false,
      status: ProcessStatus.NOT_STARTED,
    }));

    // 4. Generate folio number
    const folioNumber = await generateFolioNumber(
      this.prisma,
      tenantId,
      branchIdContext,
    );

    // 5. Create work order with CREATED status
    const workOrder = await this.prisma.workOrder.create({
      data: {
        tenantId,
        branchId: branchIdContext,
        folioNumber,
        fileNumber: fileNumber || null,
        doctorId,
        patient,
        boxNumber: boxNumber || null,
        prosthesisTypeId,
        specification: specification || null,
        color,
        notes: notes || null,
        totalQuote: 0,
        initialPayment: 0,
        status: WorkOrderStatus.CREATED,
        createdById: userId,
        processes: {
          create: mappedProcesses,
        },
      },
      include: {
        doctor: { select: { id: true, name: true, clinicName: true } },
        prosthesisType: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        processes: {
          orderBy: { sequence: 'asc' },
          include: {
            technician: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            activityLogs: {
              orderBy: { timestamp: 'asc' },
            },
          },
        },
      },
    });

    // 6. Write Audit Log
    await this.auditLogsService.log({
      tenantId,
      userId,
      action: 'WORK_ORDER_CREATE',
      entityName: 'WORK_ORDER',
      entityId: workOrder.id,
      details: {
        folioNumber,
        patient,
        createdByType: 'TECHNICIAN',
      },
    });

    // 7. Emit WS event
    this.websocketsGateway.sendToTenant(
      tenantId,
      'work_order_created',
      {
        id: workOrder.id,
        folioNumber,
        patient,
        status: workOrder.status,
        branchId: branchIdContext,
      },
    );

    this.websocketsGateway.sendToBranch(
      tenantId,
      branchIdContext,
      'work_order_created',
      {
        id: workOrder.id,
        folioNumber,
        patient,
        status: workOrder.status,
      },
    );

    return workOrder;
  }

  /**
   * Fetches details of a specific work order if the technician is assigned to a process in it or is the creator.
   */
  async getWorkOrderDetail(tenantId: string, userId: string, id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        id,
        tenantId,
        OR: [
          { processes: { some: { technicianId: userId } } },
          { createdById: userId },
        ],
      },
      include: {
        doctor: { select: { id: true, name: true, clinicName: true } },
        prosthesisType: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
        processes: {
          orderBy: { sequence: 'asc' },
          include: {
            technician: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            activityLogs: { orderBy: { timestamp: 'desc' } },
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
        notesList: {
          orderBy: { createdAt: 'asc' as const },
          include: {
            author: {
              select: { id: true, firstName: true, lastName: true, email: true, role: true },
            },
          },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(
        `Work order with ID "${id}" not found or unauthorized.`,
      );
    }

    return workOrder;
  }

  /**
   * Helper to retrieve a process step and verify it belongs to the user and tenant.
   */
  private async getVerifiedProcess(
    tenantId: string,
    userId: string,
    processId: string,
  ) {
    const process = await this.prisma.workOrderProcess.findUnique({
      where: { id: processId },
      include: {
        workOrder: true,
      },
    });

    if (!process || process.workOrder.tenantId !== tenantId) {
      throw new NotFoundException(
        `Process step with ID "${processId}" not found.`,
      );
    }

    if (process.technicianId !== userId) {
      throw new BadRequestException(
        'You are not assigned to this process step.',
      );
    }

    return process;
  }

  /**
   * Start a process step.
   */
  async startProcess(tenantId: string, userId: string, processId: string) {
    const process = await this.getVerifiedProcess(tenantId, userId, processId);

    if (process.status !== ProcessStatus.NOT_STARTED) {
      throw new BadRequestException(
        `Cannot start process: current status is ${process.status}.`,
      );
    }

    // Strict sequential execution check
    const precedingProcesses = await this.prisma.workOrderProcess.findMany({
      where: {
        workOrderId: process.workOrderId,
        sequence: { lt: process.sequence },
      },
    });

    if (precedingProcesses.some((p) => p.status !== ProcessStatus.COMPLETED)) {
      throw new BadRequestException(
        'Cannot start process: previous process steps are not completed yet.',
      );
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

    if (process.reworkActive) {
      await this.prisma.reworkLog.updateMany({
        where: {
          workOrderId: process.workOrderId,
          processName: process.processName,
          status: 'Pending',
        },
        data: {
          status: 'In Progress',
        },
      });
    }

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
      throw new BadRequestException(
        'Cannot pause process: process is not in progress.',
      );
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
      throw new BadRequestException(
        'Cannot resume process: process is not paused.',
      );
    }

    const now = new Date();
    const lastPaused = process.lastPausedAt || now;
    const pauseDuration = Math.round(
      (now.getTime() - lastPaused.getTime()) / 1000,
    );

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
      throw new BadRequestException(
        'Cannot end process: process is not active.',
      );
    }

    const now = new Date();
    let totalPause = process.totalPauseDuration;

    if (process.status === ProcessStatus.PAUSED && process.lastPausedAt) {
      const pauseDuration = Math.round(
        (now.getTime() - process.lastPausedAt.getTime()) / 1000,
      );
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
        reworkActive: false,
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

    if (process.reworkActive) {
      await this.prisma.reworkLog.updateMany({
        where: {
          workOrderId: process.workOrderId,
          processName: process.processName,
          status: { in: ['Pending', 'In Progress'] },
        },
        data: {
          status: 'Completed',
          completedAt: now,
        },
      });
    }

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
        if (!nextProcess.technicianId) {
          const workOrder = await this.prisma.workOrder.findUnique({
            where: { id: process.workOrderId },
            include: {
              doctor: {
                include: {
                  clinic: true,
                },
              },
            },
          });
          const doctor = workOrder?.doctor;
          const isExternal = doctor && doctor.clinicId && doctor.clinic?.url;

          if (!isExternal) {
            // Auto-start External Verification (ONLY for local doctor)
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
                workOrderId: process.workOrderId,
                processName: nextProcess.processName,
                type: 'EXTERNAL',
                notes: 'Started automatically after previous step completion',
              },
            });
          }

          // Trigger clinic notification or email / admin notifications via helper
          await this.triggerExternalVerification(
            tenantId,
            process.workOrderId,
            nextProcess.id,
            nextProcess.processName,
          );
        } else {
          // Internal Verification step assigned to an admin/technician
          await this.notificationsService.create({
            tenantId,
            userId: nextProcess.technicianId,
            title: 'Verification Pending',
            message: `WO "${process.workOrder.folioNumber}"${process.workOrder.boxNumber ? ` (Box: ${process.workOrder.boxNumber})` : ''} requires verification "${nextProcess.processName}".`,
            type: 'VERIFICATION_PENDING',
            referenceId: process.workOrderId,
          });

          await this.auditLogsService.log({
            tenantId,
            action: 'NOTIFICATION_TRIGGERED',
            entityName: 'NOTIFICATION',
            entityId: process.workOrderId,
            details: {
              userId: nextProcess.technicianId,
              title: 'Internal Verification Pending Alert',
            },
          });
        }
      } else if (nextProcess.technicianId) {
        // Normal technician process
        await this.notificationsService.create({
          tenantId,
          userId: nextProcess.technicianId,
          title: 'WO Step Ready',
          message: `WO "${process.workOrder.folioNumber}"${process.workOrder.boxNumber ? ` (Box: ${process.workOrder.boxNumber})` : ''} is ready. Previous step "${process.processName}" completed.`,
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
        select: { branchId: true, folioNumber: true, boxNumber: true },
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
            title: 'WO Completed',
            message: `WO "${wo.folioNumber}"${wo.boxNumber ? ` (Box: ${wo.boxNumber})` : ''} completed!`,
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

    const updated = await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: { status },
    });

    this.websocketsGateway.sendToTenant(
      updated.tenantId,
      'work_order_updated',
      {
        id: updated.id,
        folioNumber: updated.folioNumber,
        patient: updated.patient,
        status: updated.status,
        branchId: updated.branchId,
      },
    );

    if (updated.branchId) {
      this.websocketsGateway.sendToBranch(
        updated.tenantId,
        updated.branchId,
        'work_order_updated',
        {
          id: updated.id,
          folioNumber: updated.folioNumber,
          patient: updated.patient,
          status: updated.status,
        },
      );
    }
  }

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

    if (processes.some((p) => p.status === ProcessStatus.FAILED)) {
      return WorkOrderStatus.FAILED;
    }

    if (processes.some((p) => p.status === ProcessStatus.CANCELLED)) {
      return WorkOrderStatus.CANCELLED;
    }

    if (processes.every((p) => p.status === ProcessStatus.COMPLETED)) {
      return WorkOrderStatus.COMPLETED;
    }

    // Find the next active/pending step (the first step that is not completed/failed/cancelled)
    const nextStep = processes.find(
      (p) =>
        p.status !== ProcessStatus.COMPLETED &&
        p.status !== ProcessStatus.FAILED &&
        p.status !== ProcessStatus.CANCELLED,
    );

    if (nextStep && nextStep.isVerification) {
      return nextStep.technicianId
        ? WorkOrderStatus.INTERNAL_VERIFICATION
        : WorkOrderStatus.EXTERNAL_VERIFICATION;
    }

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

    const allNotStarted = processes.every(
      (p) => p.status === ProcessStatus.NOT_STARTED,
    );
    if (allNotStarted) {
      const hasAnyTechnician = processes.some((p) => p.technicianId !== null);
      return hasAnyTechnician
        ? WorkOrderStatus.ASSIGNED
        : WorkOrderStatus.CREATED;
    }

    return WorkOrderStatus.IN_PROGRESS;
  }

  /**
   * Securely update notes for a work order assigned to a technician.
   */
  async updateWorkOrderNotes(
    tenantId: string,
    userId: string,
    id: string,
    notes: string,
  ) {
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
      throw new NotFoundException(
        `Work order with ID "${id}" not found or unauthorized.`,
      );
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
