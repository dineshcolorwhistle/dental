import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { MailService } from '../mail/mail.service';
import {
  ConfigureIntegrationDto,
  CreateIntegrationWorkOrderDto,
  VerifyIntegrationWorkOrderDto,
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

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { code: true },
    });

    if (!branch) {
      throw new NotFoundException('Associated branch not found');
    }

    const count = await this.prisma.workOrder.count({
      where: { tenantId, branchId },
    });

    const nextNumber = (count + 1).toString().padStart(4, '0');
    const folioNumber = `${branch.code}${nextNumber}`;

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
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { code: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    const count = await this.prisma.workOrder.count({
      where: { tenantId, branchId },
    });
    const nextNumber = (count + 1).toString().padStart(4, '0');
    const folioNumber = `${branch.code}${nextNumber}`;

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
      isVerification: assign.process.processArea === 'QC',
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
        // If it is the first step and is verification, set it to IN_PROGRESS
        if (idx === 0 && p.isVerification && !p.technicianId) {
          return {
            ...p,
            status: ProcessStatus.IN_PROGRESS,
            startedAt: new Date(),
          };
        }
        return p;
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
          totalQuote: dto.totalQuote ?? null,
          initialPayment: dto.initialPayment ?? null,
          status: WorkOrderStatus.CREATED,
          createdById,
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
        title: 'New Work Order from Clinic',
        message: `Work Order "${workOrder.folioNumber}" (Patient: ${workOrder.patient}) has been received from the Clinic application.`,
        type: 'WORK_ORDER',
        referenceId: workOrder.id,
      });
    }

    // 6. Trigger verification email if starting with an external verification step
    const sorted = [...workOrder.processes].sort((a, b) => a.sequence - b.sequence);
    const firstProcess = sorted[0];
    if (firstProcess && firstProcess.isVerification && !firstProcess.technicianId && doctor.email) {
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

    return workOrder;
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
            status: ProcessStatus.IN_PROGRESS,
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
            status: ProcessStatus.IN_PROGRESS,
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
    );

    // Fetch the updated next step if any
    const nextStep = await this.prisma.workOrderProcess.findFirst({
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

    return {
      success: true,
      message: `Verification outcome ${dto.outcome} submitted successfully.`,
      nextStep: nextStep || null,
    };
  }
}
