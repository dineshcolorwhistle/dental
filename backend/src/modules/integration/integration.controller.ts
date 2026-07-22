import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { generateFolioNumber } from '../../common/utils/folio.util';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { MailService } from '../mail/mail.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MessagesService } from '../messages/messages.service';
import { WebsocketsGateway } from '../websockets/websockets.gateway';
import * as bcrypt from 'bcrypt';
import {
  ConfigureIntegrationDto,
  CreateIntegrationWorkOrderDto,
  VerifyIntegrationWorkOrderDto,
  StartVerificationDto,
} from './dto';
import {
  UserRole,
  UserStatus,
  ProcessStatus,
  WorkOrderStatus,
  ProcessActivityAction,
} from '@prisma/client';

/**
 * Integration endpoints consumed by the external Clinic Portal.
 * All routes are guarded by the ApiKeyGuard (X-API-Key header).
 * They bypass the global JWT and Roles guards via @Public().
 */
@ApiTags('Integration')
@Controller('integration')
@Public() // Bypass JWT auth — these endpoints use API key auth instead
@UseGuards(ApiKeyGuard)
export class IntegrationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly workOrdersService: WorkOrdersService,
    private readonly mailService: MailService,
    private readonly auditLogsService: AuditLogsService,
    private readonly messagesService: MessagesService,
    private readonly websocketsGateway: WebsocketsGateway,
  ) {}

  @Get('doctors')
  @ApiOperation({
    summary: 'List doctors scoped to the API key branch/tenant',
  })
  async getDoctors(@Req() req: any) {
    const tenantId = req.apiKeyTenantId;
    const branchId = req.apiKeyBranchId;

    return this.prisma.doctor.findMany({
      where: {
        tenantId,
        branchId,
        isActive: true,
      },
      select: {
        id: true,
        externalId: true,
        name: true,
        clinicName: true,
        email: true,
        phone: true,
        address: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }



  @Post('config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Configure integration with external clinic URL and name',
  })
  async configure(
    @Req() req: any,
    @Body() dto: ConfigureIntegrationDto,
  ) {
    const tenantId = req.apiKeyTenantId;
    const branchId = req.apiKeyBranchId;

    let clinic = await this.prisma.clinic.findFirst({
      where: {
        url: dto.clinicUrl,
        tenantId,
        branchId,
      },
    });

    if (clinic) {
      clinic = await this.prisma.clinic.update({
        where: { id: clinic.id },
        data: {
          name: dto.clinicName,
        },
      });
    } else {
      clinic = await this.prisma.clinic.create({
        data: {
          tenantId,
          branchId,
          url: dto.clinicUrl,
          name: dto.clinicName,
        },
      });
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      include: { tenant: true },
    });

    if (!branch) {
      throw new NotFoundException('Lab branch associated with API key not found');
    }

    return {
      success: true,
      lab: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        organization: branch.tenant.name,
      },
      clinic: {
        id: clinic.id,
        name: clinic.name,
        url: clinic.url,
      },
    };
  }

  @Get('work-orders/setup')
  @ApiOperation({
    summary: 'Retrieve prosthesis types and next folio number for WO setup',
  })
  async getWorkOrderSetup(@Req() req: any) {
    const tenantId = req.apiKeyTenantId;
    const branchId = req.apiKeyBranchId;

    const prosthesisTypes = await this.prisma.prosthesisType.findMany({
      where: {
        tenantId,
        OR: [
          { branchId: null },
          { branchId },
        ],
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });

    const folioNumber = await generateFolioNumber(
      this.prisma,
      tenantId,
      branchId,
    );

    return {
      prosthesisTypes,
      nextFolioNumber: folioNumber,
    };
  }

  @Post('work-orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new work order automatically from the external clinic',
  })
  async createWorkOrder(
    @Req() req: any,
    @Body() dto: CreateIntegrationWorkOrderDto,
  ) {
    const tenantId = req.apiKeyTenantId;
    const branchId = req.apiKeyBranchId;

    // Validate that the clinic URL is configured
    const clinic = await this.prisma.clinic.findFirst({
      where: {
        url: dto.clinicUrl,
        tenantId,
        branchId,
      },
    });

    if (!clinic) {
      throw new NotFoundException(
        `Clinic with URL "${dto.clinicUrl}" not configured. Please run configuration setup first.`,
      );
    }

    // Resolve or create the doctor dynamically
    let doctor = await this.prisma.doctor.findFirst({
      where: {
        name: dto.doctorName,
        clinicId: clinic.id,
        tenantId,
        branchId,
      },
    });

    if (doctor) {
      // Update doctor contact details if they are provided
      doctor = await this.prisma.doctor.update({
        where: { id: doctor.id },
        data: {
          email: dto.doctorEmail || doctor.email,
          phone: dto.doctorPhone || doctor.phone,
          address: dto.doctorAddress || doctor.address,
          clinicName: clinic.name,
          externalId: clinic.url,
        },
      });
    } else {
      doctor = await this.prisma.doctor.create({
        data: {
          tenantId,
          branchId,
          clinicId: clinic.id,
          name: dto.doctorName,
          email: dto.doctorEmail,
          phone: dto.doctorPhone,
          address: dto.doctorAddress,
          clinicName: clinic.name,
          externalId: clinic.url,
          isActive: true,
        },
      });
    }

    const prosthesisType = await this.prisma.prosthesisType.findFirst({
      where: {
        id: dto.prosthesisTypeId,
        tenantId,
        OR: [
          { branchId: null },
          { branchId },
        ],
      },
    });

    if (!prosthesisType) {
      throw new NotFoundException(
        `Prosthesis type with ID "${dto.prosthesisTypeId}" not found.`,
      );
    }

    // 1. Generate folio number
    const folioNumber = await generateFolioNumber(
      this.prisma,
      tenantId,
      branchId,
    );

    // 2. Fetch default process steps for this prosthesis type
    const processAssignments = await this.prisma.prosthesisTypeProcess.findMany({
      where: { prosthesisTypeId: prosthesisType.id },
      include: { process: true },
      orderBy: { sequence: 'asc' },
    });

    const mappedProcesses = processAssignments.map((assign) => ({
      processName: assign.process.name,
      technicianId: assign.process.defaultTechnicianId || null,
      sequence: assign.sequence,
      isVerification: false,
      status: ProcessStatus.NOT_STARTED,
    }));

    // 3. Find creator user (oldest/first admin of the branch)
    const branchAdmin = await this.prisma.user.findFirst({
      where: {
        tenantId,
        branchId,
        role: { in: [UserRole.ADMIN, UserRole.OWNER] },
        status: UserStatus.ACTIVE,
      },
      orderBy: { createdAt: 'asc' },
    });

    const fallbackUser = await this.prisma.user.findFirst({
      where: { tenantId, branchId, status: UserStatus.ACTIVE },
    });

    const createdById = branchAdmin?.id || fallbackUser?.id;

    if (!createdById) {
      throw new BadRequestException(
        'No active user found in this branch to associate with the work order creation.',
      );
    }

    // 4. Create the work order and associated processes in a transaction
    const workOrder = await this.prisma.$transaction(async (tx) => {
      // Determine starting statuses
      const finalMappedProcesses = mappedProcesses.map((p, idx) => {
        const isVerification = p.isVerification || false;
        const processName = isVerification
          ? p.technicianId
            ? 'Verification (Internal)'
            : 'Verification (External)'
          : p.processName;
        const updated = {
          ...p,
          isVerification,
          processName,
        };
        return updated;
      });

      return tx.workOrder.create({
        data: {
          tenantId,
          branchId,
          folioNumber,
          doctorId: doctor.id,
          patient: dto.patient,
          boxNumber: dto.boxNumber || null,
          prosthesisTypeId: prosthesisType.id,
          color: dto.color || 'A1',
          notes: dto.notes || null,
          specification: dto.specification || '',
          totalQuote: dto.totalQuote ?? null,
          initialPayment: dto.initialPayment ?? null,
          status: WorkOrderStatus.CREATED,
          createdById,
          isExternal: true,
          processes: {
            create: finalMappedProcesses,
          },
        },
        include: {
          processes: true,
          doctor: true,
          prosthesisType: true,
        },
      });
    });

    // 5. Send notifications to all active admins and owners of this branch
    const admins = await this.prisma.user.findMany({
      where: {
        tenantId,
        branchId,
        role: { in: [UserRole.ADMIN, UserRole.OWNER] },
        status: UserStatus.ACTIVE,
      },
    });

    for (const admin of admins) {
      await this.notificationsService.create({
        tenantId,
        userId: admin.id,
        title: 'New WO from Clinic',
        message: `WO "${workOrder.folioNumber}" (${workOrder.patient}) received from Clinic.`,
        type: 'WORK_ORDER',
        referenceId: workOrder.id,
      });
    }

    // 6. Trigger verification email and clinic notification if starting with an external verification step
    const sorted = [...workOrder.processes].sort((a, b) => a.sequence - b.sequence);
    const firstProcess = sorted[0];
    if (firstProcess && firstProcess.isVerification && !firstProcess.technicianId) {
      if (doctor.email) {
        const tenantRecord = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
        });
        await this.mailService.sendExternalVerificationPending(
          doctor.email,
          doctor.name,
          workOrder.patient,
          workOrder.folioNumber,
          firstProcess.processName,
          tenantRecord?.name || 'DentalLab',
        );
      }

      // Notify the clinic system via HTTP POST since it's an integrated doctor
      if (clinic.url) {
        const notificationUrl = `${clinic.url}/api/integration/notifications`;
        const logger = new Logger('IntegrationController');
        logger.log(`Notifying integrated clinic at ${notificationUrl} for WO ${workOrder.folioNumber}`);

        const apiKeyRecord = await this.prisma.apiKey.findFirst({
          where: {
            branchId,
            isActive: true,
          },
        });
        const apiKey = apiKeyRecord ? apiKeyRecord.key : '';

        try {
          await (global as any).fetch(notificationUrl, {
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
              processName: firstProcess.processName,
              doctor: {
                id: doctor.id,
                name: doctor.name,
                email: doctor.email,
              },
            }),
          });
        } catch (err: any) {
          logger.error(`Error notifying clinic at ${notificationUrl}: ${err.message}`);
        }
      }
    }

    // Emit real-time WebSocket event for Dashboard & WorkOrders pages
    this.websocketsGateway.sendToTenant(tenantId, 'work_order_created', {
      id: workOrder.id,
      folioNumber,
      patient: workOrder.patient,
      status: workOrder.status,
      branchId,
    });

    this.websocketsGateway.sendToBranch(tenantId, branchId, 'work_order_created', {
      id: workOrder.id,
      folioNumber,
      patient: workOrder.patient,
      status: workOrder.status,
    });

    return {
      ...workOrder,
      createdBy: {
        id: doctor.id,
        firstName: doctor.name,
        lastName: '',
        role: 'DOCTOR' as any,
        email: doctor.email || '',
      },
    };
  }

  @Get('work-orders/pending-verifications')
  @ApiOperation({
    summary: 'Retrieve pending external verification steps for the clinic',
  })
  async getPendingVerifications(
    @Req() req: any,
    @Query('clinicUrl') clinicUrl: string,
  ) {
    const tenantId = req.apiKeyTenantId;
    const branchId = req.apiKeyBranchId;

    if (!clinicUrl) {
      throw new BadRequestException('Parameter clinicUrl is required');
    }

    const clinic = await this.prisma.clinic.findFirst({
      where: {
        url: clinicUrl,
        tenantId,
        branchId,
      },
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with URL "${clinicUrl}" not found.`);
    }

    return this.prisma.workOrder.findMany({
      where: {
        tenantId,
        branchId,
        doctor: {
          clinicId: clinic.id,
        },
        processes: {
          some: {
            isVerification: true,
            status: { in: [ProcessStatus.NOT_STARTED, ProcessStatus.IN_PROGRESS] },
            technicianId: null,
          },
        },
      },
      include: {
        prosthesisType: {
          select: { id: true, name: true },
        },
        processes: {
          where: {
            isVerification: true,
            status: { in: [ProcessStatus.NOT_STARTED, ProcessStatus.IN_PROGRESS] },
            technicianId: null,
          },
          select: {
            id: true,
            processName: true,
            status: true,
            startedAt: true,
            sequence: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('work-orders/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit a verification outcome (SUCCESS, REWORK, REPETITION) for a work order',
  })
  async verifyWorkOrder(
    @Req() req: any,
    @Body() dto: VerifyIntegrationWorkOrderDto,
  ) {
    const tenantId = req.apiKeyTenantId;
    const branchId = req.apiKeyBranchId;

    const clinic = await this.prisma.clinic.findFirst({
      where: {
        url: dto.clinicUrl,
        tenantId,
        branchId,
      },
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with URL "${dto.clinicUrl}" not found.`);
    }

    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        id: dto.workOrderId,
        tenantId,
        branchId,
        doctor: {
          clinicId: clinic.id,
        },
      },
      include: {
        processes: true,
      },
    });

    if (!workOrder) {
      throw new NotFoundException(
        `Work order with ID "${dto.workOrderId}" associated with clinic URL "${dto.clinicUrl}" not found.`,
      );
    }

    const pendingVerification = workOrder.processes.find(
      (p) => p.isVerification && p.status === ProcessStatus.IN_PROGRESS && !p.technicianId,
    );

    if (!pendingVerification) {
      throw new BadRequestException('No pending external verification step found for this work order.');
    }

    // Find the default admin or branch admin user to execute on their behalf (to bypass the Guard userId check)
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    const branchAdmin = await this.prisma.user.findFirst({
      where: {
        tenantId,
        branchId,
        role: { in: [UserRole.ADMIN, UserRole.OWNER] },
        status: UserStatus.ACTIVE,
      },
      orderBy: { createdAt: 'asc' },
    });

    const adminUserId = branch?.defaultAdminId || branchAdmin?.id;

    if (!adminUserId) {
      throw new BadRequestException('No active branch administrator found to complete verification.');
    }

    // Process completion and transitions using endVerification
    await this.workOrdersService.endVerification(
      tenantId,
      workOrder.id,
      pendingVerification.id,
      dto.outcome,
      adminUserId,
      dto.reworkProcessNames,
    );

    // Write Audit Log
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: workOrder.doctorId },
    });
    if (doctor) {
      await this.auditLogsService.log({
        tenantId,
        userEmail: doctor.email || 'doctor@integration.com',
        action: 'VERIFICATION_END_EXTERNAL',
        entityName: 'PROCESS',
        entityId: pendingVerification.id,
        details: {
          workOrderId: workOrder.id,
          processName: pendingVerification.processName,
          outcome: dto.outcome,
          notes: dto.notes,
          clinicUrl: dto.clinicUrl,
          doctorName: doctor.name,
        },
      });
    }

    // Fetch the updated next step based on outcome
    let nextStep: { processName: string; status: string } | null = null;

    if (dto.outcome === 'REWORK') {
      nextStep = await this.prisma.workOrderProcess.findFirst({
        where: {
          workOrderId: workOrder.id,
          reworkActive: true,
        },
        orderBy: { sequence: 'asc' },
        select: {
          processName: true,
          status: true,
        },
      });
    } else if (dto.outcome === 'REPETITION') {
      nextStep = await this.prisma.workOrderProcess.findFirst({
        where: {
          workOrderId: workOrder.id,
        },
        orderBy: { sequence: 'asc' },
        select: {
          processName: true,
          status: true,
        },
      });
    } else {
      nextStep = await this.prisma.workOrderProcess.findFirst({
        where: {
          workOrderId: workOrder.id,
          sequence: { gt: pendingVerification.sequence },
        },
        orderBy: { sequence: 'asc' },
        select: {
          processName: true,
          status: true,
        },
      });
    }

    return {
      success: true,
      message: `Verification outcome ${dto.outcome} submitted successfully.`,
      nextStep: nextStep || null,
    };
  }

  @Post('work-orders/start-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Notify that the external doctor has started the verification process',
  })
  async startVerification(
    @Req() req: any,
    @Body() dto: StartVerificationDto,
  ) {
    const tenantId = req.apiKeyTenantId;
    const branchId = req.apiKeyBranchId;

    const clinic = await this.prisma.clinic.findFirst({
      where: {
        url: dto.clinicUrl,
        tenantId,
        branchId,
      },
    });

    if (!clinic) {
      throw new NotFoundException(`Clinic with URL "${dto.clinicUrl}" not found.`);
    }

    const doctor = await this.prisma.doctor.findFirst({
      where: {
        id: dto.doctorId,
        clinicId: clinic.id,
        tenantId,
        branchId,
      },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID "${dto.doctorId}" not found.`);
    }

    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        id: dto.workOrderId,
        tenantId,
        branchId,
        doctorId: doctor.id,
      },
      include: {
        processes: true,
      },
    });

    if (!workOrder) {
      throw new NotFoundException(
        `Work order with ID "${dto.workOrderId}" not found for this doctor/clinic.`,
      );
    }

    const pendingVerification = workOrder.processes.find(
      (p) => p.isVerification && p.status === ProcessStatus.NOT_STARTED && !p.technicianId,
    );

    if (!pendingVerification) {
      throw new BadRequestException('No pending external verification step found for this work order.');
    }

    // Set status to IN_PROGRESS, startedAt, and log the START activity
    const now = new Date();
    await this.prisma.workOrderProcess.update({
      where: { id: pendingVerification.id },
      data: {
        status: ProcessStatus.IN_PROGRESS,
        startedAt: now,
        activityLogs: {
          create: {
            action: ProcessActivityAction.START,
            timestamp: now,
            notes: 'Verification started by external doctor',
          },
        },
      },
    });

    await this.workOrdersService.updateWorkOrderStatus(workOrder.id);

    // Write Audit Log
    await this.auditLogsService.log({
      tenantId,
      userEmail: doctor.email || 'doctor@integration.com',
      action: 'VERIFICATION_START_EXTERNAL',
      entityName: 'PROCESS',
      entityId: pendingVerification.id,
      details: {
        workOrderId: workOrder.id,
        processName: pendingVerification.processName,
        clinicUrl: dto.clinicUrl,
        doctorName: doctor.name,
      },
    });

    return {
      success: true,
      message: 'External verification start recorded successfully.',
    };
  }

  @Get('work-orders/:id')
  @ApiOperation({
    summary: 'Retrieve work order status by ID for external clinic/doctors',
  })
  async getWorkOrderStatus(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const tenantId = req.apiKeyTenantId;
    const branchId = req.apiKeyBranchId;

    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        id,
        tenantId,
        branchId,
      },
      include: {
        prosthesisType: {
          select: { id: true, name: true },
        },
        doctor: {
          select: { id: true, name: true, clinicName: true },
        },
        branch: {
          select: {
            defaultAdmin: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        processes: {
          include: {
            technician: {
              select: { firstName: true, lastName: true },
            },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work order with ID "${id}" not found.`);
    }

    return {
      id: workOrder.id,
      folioNumber: workOrder.folioNumber,
      patient: workOrder.patient,
      boxNumber: workOrder.boxNumber,
      color: workOrder.color,
      notes: workOrder.notes,
      specification: workOrder.specification,
      status: workOrder.status,
      repetitionCount: workOrder.repetitionCount,
      createdAt: workOrder.createdAt,
      updatedAt: workOrder.updatedAt,
      doctor: workOrder.doctor
        ? {
            id: workOrder.doctor.id,
            name: workOrder.doctor.name,
            clinicName: workOrder.doctor.clinicName,
          }
        : null,
      prosthesisType: workOrder.prosthesisType
        ? {
            id: workOrder.prosthesisType.id,
            name: workOrder.prosthesisType.name,
          }
        : null,
      processes: workOrder.processes.map((p) => ({
        id: p.id,
        processName: p.processName,
        sequence: p.sequence,
        status: p.status,
        startedAt: p.startedAt,
        endedAt: p.endedAt,
        technicianName: (() => {
          if (p.isVerification) {
            if (p.technicianId) {
              const defaultAdmin = (workOrder as any).branch?.defaultAdmin;
              return defaultAdmin
                ? `${defaultAdmin.firstName} ${defaultAdmin.lastName}`.trim()
                : (p.technician ? `${p.technician.firstName} ${p.technician.lastName}`.trim() : 'Lab Admin');
            } else {
              return workOrder.doctor ? workOrder.doctor.name : 'Doctor';
            }
          }
          return p.technician
            ? `${p.technician.firstName} ${p.technician.lastName}`.trim()
            : null;
        })(),
      })),
    };
  }

  // ─── Work Order Chat (Integration) ────────────────────────

  private readonly chatLogger = new Logger('IntegrationChat');

  /**
   * Resolve or create a User record for a doctor so they can participate in chat.
   */
  private async getOrCreateDoctorUser(
    tenantId: string,
    branchId: string,
    doctorId: string,
  ) {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        userId: true,
        user: { select: { id: true } },
      },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found.');
    }

    // If doctor already has a linked user, return it
    if (doctor.userId && doctor.user) {
      return doctor.user.id;
    }

    // Create a placeholder User with DOCTOR role
    const dummyHash = await bcrypt.hash(`doctor-${doctor.id}-${Date.now()}`, 10);
    const nameParts = doctor.name.split(' ');
    const firstName = nameParts[0] || 'Doctor';
    const lastName = nameParts.slice(1).join(' ') || '';

    const newUser = await this.prisma.user.create({
      data: {
        tenantId,
        branchId,
        email: doctor.email || `doctor-${doctor.id}@placeholder.local`,
        passwordHash: dummyHash,
        firstName,
        lastName,
        role: UserRole.DOCTOR,
        status: UserStatus.ACTIVE,
      },
    });

    // Link doctor to user
    await this.prisma.doctor.update({
      where: { id: doctor.id },
      data: { userId: newUser.id },
    });

    this.chatLogger.log(
      `Created placeholder User (${newUser.id}) for doctor ${doctor.name} (${doctor.id})`,
    );

    return newUser.id;
  }

  @Get('work-orders/:id/messages')
  @ApiOperation({
    summary: 'Retrieve chat messages for a work order (external clinic)',
  })
  async getWorkOrderMessages(
    @Req() req: any,
    @Param('id') workOrderId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = req.apiKeyTenantId;
    const branchId = req.apiKeyBranchId;

    // Verify WO exists and belongs to this tenant/branch
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId, branchId },
      select: {
        id: true,
        doctorId: true,
        folioNumber: true,
      },
    });

    if (!workOrder) {
      throw new NotFoundException('Work order not found.');
    }

    // Ensure doctor has a user account
    const doctorUserId = await this.getOrCreateDoctorUser(
      tenantId,
      branchId,
      workOrder.doctorId,
    );

    // Get or create the WO conversation using the doctor's user context
    const conversation =
      await this.messagesService.getOrCreateWorkOrderConversation(
        {
          id: doctorUserId,
          tenantId,
          branchId,
          role: UserRole.DOCTOR,
        },
        workOrderId,
      );

    // Fetch messages
    const messages = await this.messagesService.getMessages(
      {
        id: doctorUserId,
        tenantId,
        branchId,
        role: UserRole.DOCTOR,
      },
      conversation.id,
      cursor,
      limit ? parseInt(limit, 10) : 50,
    );

    return {
      conversation: {
        id: conversation.id,
        name: conversation.name,
        participants: conversation.participants,
      },
      ...messages,
    };
  }

  @Post('work-orders/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send a chat message for a work order (external clinic/doctor)',
  })
  async sendWorkOrderMessage(
    @Req() req: any,
    @Param('id') workOrderId: string,
    @Body() body: { content: string },
  ) {
    const tenantId = req.apiKeyTenantId;
    const branchId = req.apiKeyBranchId;

    if (!body.content || !body.content.trim()) {
      throw new BadRequestException('Message content is required.');
    }

    // Verify WO exists
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId, branchId },
      select: { id: true, doctorId: true },
    });

    if (!workOrder) {
      throw new NotFoundException('Work order not found.');
    }

    // Ensure doctor has a user account
    const doctorUserId = await this.getOrCreateDoctorUser(
      tenantId,
      branchId,
      workOrder.doctorId,
    );

    // Get or create the WO conversation
    const conversation =
      await this.messagesService.getOrCreateWorkOrderConversation(
        {
          id: doctorUserId,
          tenantId,
          branchId,
          role: UserRole.DOCTOR,
        },
        workOrderId,
      );

    // Send the message as the doctor
    const message = await this.messagesService.sendMessage(
      {
        id: doctorUserId,
        tenantId,
        branchId,
        role: UserRole.DOCTOR,
      },
      conversation.id,
      body.content.trim(),
    );

    return message;
  }
}
