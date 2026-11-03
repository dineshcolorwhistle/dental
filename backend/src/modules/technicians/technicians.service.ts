import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateTechnicianDto, UpdateTechnicianDto } from './dto';
import { UserRole, UserStatus, ProcessStatus } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class TechniciansService {
  private readonly logger = new Logger(TechniciansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    @InjectQueue('email-queue') private readonly emailQueue: Queue,
  ) {}

  /**
   * Create (invite) a new technician user.
   */
  async create(
    tenantId: string,
    branchIdContext: string | null,
    userRole: string,
    dto: CreateTechnicianDto,
  ) {
    const { email, firstName, lastName, phone, branchId } = dto;

    // If logged in as ADMIN, force their branch context
    let finalBranchId = branchId;
    if (userRole === 'ADMIN') {
      if (!branchIdContext) {
        throw new BadRequestException(
          'Branch context is required for administrators.',
        );
      }
      finalBranchId = branchIdContext;
    }

    // 1. Verify that the branch belongs to the tenant and get details
    const branch = await this.prisma.branch.findFirst({
      where: { id: finalBranchId, tenantId },
    });

    if (!branch) {
      throw new NotFoundException(
        `Branch with ID "${finalBranchId}" does not exist in your organization.`,
      );
    }

    // Check user limits — only active/invited users count against the limit
    const currentTechniciansCount = await this.prisma.user.count({
      where: {
        tenantId,
        role: UserRole.TECHNICIAN,
        status: { not: UserStatus.INACTIVE },
      },
    });

    // Load tenant name, subdomain, and limit details
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, subdomain: true, maxTechnicians: true },
    });

    if (!tenant) {
      throw new NotFoundException('Organization not found.');
    }

    if (currentTechniciansCount >= tenant.maxTechnicians) {
      throw new BadRequestException(
        `Your organization has reached the limit of ${tenant.maxTechnicians} active Lab Technician(s).`,
      );
    }

    // 2. Check if a user with this email already exists inside this tenant
    const existingUser = await this.prisma.user.findFirst({
      where: { email, tenantId },
    });

    if (existingUser) {
      throw new ConflictException(
        `A user with the email "${email}" already exists in your organization.`,
      );
    }

    // 3. Generate password hash for temporary password
    const tempPassword = uuidv4();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // 4. Create user and password reset token in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Check if branch already has a default technician
      const branchDetails = await tx.branch.findUnique({
        where: { id: finalBranchId },
        select: { defaultTechnicianId: true },
      });

      const makeDefault = !branchDetails || !branchDetails.defaultTechnicianId;

      const technician = await tx.user.create({
        data: {
          tenantId,
          branchId: finalBranchId,
          email,
          passwordHash,
          firstName,
          lastName,
          phone,
          role: UserRole.TECHNICIAN,
          status: UserStatus.INVITED,
        },
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
              defaultTechnicianId: true,
            },
          },
        },
      });

      // Automatically assign the first technician as Default Technician
      if (makeDefault) {
        await tx.branch.update({
          where: { id: finalBranchId },
          data: { defaultTechnicianId: technician.id },
        });
      }

      // Create password reset token (24h expiry)
      const resetToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await tx.passwordResetToken.create({
        data: {
          userId: technician.id,
          token: resetToken,
          expiresAt,
        },
      });

      return { technician, resetToken };
    });

    // 5. Send invitation email (non-blocking)
    try {
      await this.emailQueue.add('send-technician-invite', {
        email,
        technicianName: `${firstName} ${lastName}`,
        tenantName: tenant.name,
        branchName: branch.name,
        resetToken: result.resetToken,
        subdomain: tenant.subdomain,
      });
    } catch (emailError) {
      this.logger.warn(
        `Failed to queue invitation email for ${email}: ${emailError.message}`,
      );
      // Don't fail the entire operation if email queueing fails
    }

    this.logger.log(
      `Technician created: ${email} for branch ${branch.name} inside tenant ${tenantId}`,
    );

    return result.technician;
  }

  /**
   * List all technicians in the organization or filtered by branch.
   */
  async findAll(
    tenantId: string,
    branchIdFilter?: string,
    includeAdmins?: boolean,
  ) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        role: includeAdmins
          ? {
              in: [
                UserRole.TECHNICIAN,
                UserRole.ADMIN,
                UserRole.OWNER,
                UserRole.SUPER_ADMIN,
              ],
            }
          : UserRole.TECHNICIAN,
        ...(branchIdFilter &&
          branchIdFilter !== 'ALL' && {
            OR: [{ branchId: branchIdFilter }, { branchId: null }],
          }),
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultTechnicianId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find details of a specific technician.
   */
  async findOne(tenantId: string, id: string, branchIdContext?: string | null) {
    const technician = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
        role: UserRole.TECHNICIAN,
        ...(branchIdContext && { branchId: branchIdContext }),
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultTechnicianId: true,
          },
        },
      },
    });

    if (!technician) {
      throw new NotFoundException(`Technician with ID "${id}" not found.`);
    }

    return technician;
  }

  /**
   * Set a technician as the default technician for their branch.
   * Only Lab Admins can perform this action.
   */
  async setDefaultTechnician(
    tenantId: string,
    branchIdContext: string,
    technicianId: string,
  ) {
    const technician = await this.prisma.user.findFirst({
      where: {
        id: technicianId,
        tenantId,
        branchId: branchIdContext,
        role: UserRole.TECHNICIAN,
        status: UserStatus.ACTIVE,
      },
    });

    if (!technician) {
      throw new NotFoundException(
        'Active technician not found in your branch.',
      );
    }

    await this.prisma.branch.update({
      where: { id: branchIdContext },
      data: { defaultTechnicianId: technicianId },
    });

    this.logger.log(
      `Default technician set to ${technician.email} for branch ${branchIdContext}`,
    );

    return { success: true, defaultTechnicianId: technicianId };
  }

  /**
   * Check whether a technician can be safely inactivated.
   */
  async checkInactivation(
    tenantId: string,
    id: string,
    branchIdContext?: string | null,
  ) {
    const technician = await this.findOne(tenantId, id, branchIdContext);

    const branch = technician.branchId
      ? await this.prisma.branch.findUnique({
          where: { id: technician.branchId },
          select: { id: true, defaultTechnicianId: true },
        })
      : null;

    const isDefaultTechnician = branch?.defaultTechnicianId === technician.id;

    // Check for in-progress or paused work order processes
    const activeProcesses = await this.prisma.workOrderProcess.findMany({
      where: {
        technicianId: id,
        status: { in: [ProcessStatus.IN_PROGRESS, ProcessStatus.PAUSED] },
        workOrder: { tenantId },
      },
      include: {
        workOrder: { select: { id: true, folioNumber: true } },
      },
    });

    const activeWorkOrders = [
      ...new Set(
        activeProcesses
          .map((p) => p.workOrder?.folioNumber)
          .filter((f): f is string => Boolean(f)),
      ),
    ];

    // Count pending (NOT_STARTED) processes across all work orders
    const pendingProcessesCount = await this.prisma.workOrderProcess.count({
      where: {
        technicianId: id,
        status: ProcessStatus.NOT_STARTED,
        workOrder: { tenantId },
      },
    });

    let defaultTechnician: { id: string; name: string; email: string } | null = null;
    if (
      branch?.defaultTechnicianId &&
      branch.defaultTechnicianId !== technician.id
    ) {
      const dt = await this.prisma.user.findUnique({
        where: { id: branch.defaultTechnicianId },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      if (dt) {
        defaultTechnician = {
          id: dt.id,
          name: `${dt.firstName} ${dt.lastName}`.trim(),
          email: dt.email,
        };
      }
    }

    return {
      canInactivate: activeWorkOrders.length === 0 && !isDefaultTechnician,
      isDefaultTechnician,
      activeWorkOrders,
      pendingProcessesCount,
      defaultTechnician,
    };
  }

  /**
   * Update technician details and handle inactivation process flow.
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateTechnicianDto,
    branchIdContext?: string | null,
    callerUserId?: string | null,
  ) {
    // 1. Verify technician exists
    const currentTechnician = await this.findOne(tenantId, id, branchIdContext);

    const { firstName, lastName, phone, branchId, status } = dto;

    // 2. If branch is updated, verify it belongs to this tenant
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, tenantId },
      });

      if (!branch) {
        throw new NotFoundException(
          `Branch with ID "${branchId}" does not exist in your organization.`,
        );
      }
    }

    // 3. Reactivation limit check: when moving from INACTIVE to ACTIVE
    if (
      status === UserStatus.ACTIVE &&
      currentTechnician.status === UserStatus.INACTIVE
    ) {
      const currentActiveCount = await this.prisma.user.count({
        where: {
          tenantId,
          role: UserRole.TECHNICIAN,
          status: { not: UserStatus.INACTIVE },
        },
      });

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { maxTechnicians: true },
      });

      if (tenant && currentActiveCount >= tenant.maxTechnicians) {
        throw new BadRequestException(
          `Cannot reactivate: your organization has reached the limit of ${tenant.maxTechnicians} active Lab Technician(s).`,
        );
      }
    }

    // 4. Inactivation process flow validations & reassignment
    if (
      status === UserStatus.INACTIVE &&
      currentTechnician.status !== UserStatus.INACTIVE
    ) {
      const branch = currentTechnician.branchId
        ? await this.prisma.branch.findUnique({
            where: { id: currentTechnician.branchId },
            select: { id: true, defaultTechnicianId: true },
          })
        : null;

      // 4a. Default Technician cannot be inactivated
      if (branch?.defaultTechnicianId === currentTechnician.id) {
        throw new BadRequestException(
          'Cannot deactivate the default technician. Please designate another technician as the default technician first.',
        );
      }

      // 4b. Validation: check for In Progress or Paused processes
      const activeProcesses = await this.prisma.workOrderProcess.findMany({
        where: {
          technicianId: id,
          status: { in: [ProcessStatus.IN_PROGRESS, ProcessStatus.PAUSED] },
          workOrder: { tenantId },
        },
        include: {
          workOrder: { select: { id: true, folioNumber: true } },
        },
      });

      if (activeProcesses.length > 0) {
        const folios = [
          ...new Set(
            activeProcesses
              .map((p) => p.workOrder?.folioNumber)
              .filter((f): f is string => Boolean(f)),
          ),
        ];
        throw new BadRequestException(
          `Cannot deactivate technician with in-progress or paused processes in Work Order(s): ${folios.join(', ')}. Please complete or reassign them first.`,
        );
      }

      // 4c. Ensure an active default technician exists for reassignment
      if (!branch?.defaultTechnicianId) {
        throw new BadRequestException(
          'Branch does not have a designated default technician. Please designate a default technician before deactivating this technician.',
        );
      }

      const defaultTech = await this.prisma.user.findFirst({
        where: {
          id: branch.defaultTechnicianId,
          tenantId,
          status: UserStatus.ACTIVE,
        },
      });

      if (!defaultTech) {
        throw new BadRequestException(
          'The branch default technician is not active. Please designate an active default technician first.',
        );
      }

      // 4d. Fetch all NOT_STARTED processes for granular audit logging and reassignment
      const pendingProcesses = await this.prisma.workOrderProcess.findMany({
        where: {
          technicianId: id,
          status: ProcessStatus.NOT_STARTED,
          workOrder: { tenantId },
        },
        include: {
          workOrder: { select: { id: true, folioNumber: true } },
        },
      });

      // 4e. Atomic transaction for process reassignment and status update
      const updated = await this.prisma.$transaction(async (tx) => {
        if (pendingProcesses.length > 0) {
          await tx.workOrderProcess.updateMany({
            where: {
              technicianId: id,
              status: ProcessStatus.NOT_STARTED,
            },
            data: {
              technicianId: branch.defaultTechnicianId,
            },
          });
        }

        // Reassign template process default technician if it matched
        if (currentTechnician.branchId) {
          await tx.process.updateMany({
            where: {
              branchId: currentTechnician.branchId,
              defaultTechnicianId: id,
            },
            data: {
              defaultTechnicianId: branch.defaultTechnicianId,
            },
          });
        }

        return tx.user.update({
          where: { id },
          data: {
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(phone !== undefined && { phone }),
            ...(branchId && { branchId }),
            status: UserStatus.INACTIVE,
          },
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
                defaultTechnicianId: true,
              },
            },
          },
        });
      });

      // 4f. Write granular audit log for each reassigned non-started process
      for (const proc of pendingProcesses) {
        try {
          await this.auditLogsService.log({
            tenantId,
            userId: callerUserId || null,
            action: 'PROCESS_REASSIGNED',
            entityName: 'WORK_ORDER_PROCESS',
            entityId: proc.id,
            details: {
              workOrderId: proc.workOrderId,
              folioNumber: proc.workOrder?.folioNumber,
              processName: proc.processName,
              previousTechnicianId: id,
              previousTechnicianName: `${currentTechnician.firstName} ${currentTechnician.lastName}`.trim(),
              newTechnicianId: defaultTech.id,
              newTechnicianName: `${defaultTech.firstName} ${defaultTech.lastName}`.trim(),
              reason: 'Technician deactivated - auto-reassigned to Default Technician',
            },
          });
        } catch (logErr) {
          this.logger.warn(`Failed to log audit entry for reassigned process ${proc.id}: ${logErr.message}`);
        }
      }

      // 4g. Write summary audit log on the USER entity
      const affectedFolios = [
        ...new Set(
          pendingProcesses
            .map((p) => p.workOrder?.folioNumber)
            .filter((f): f is string => Boolean(f)),
        ),
      ];
      try {
        await this.auditLogsService.log({
          tenantId,
          userId: callerUserId || null,
          action: 'DEACTIVATE',
          entityName: 'USER',
          entityId: id,
          details: {
            role: UserRole.TECHNICIAN,
            email: currentTechnician.email,
            reassignedProcessesCount: pendingProcesses.length,
            reassignedWorkOrders: affectedFolios,
            reassignedToTechnicianId: defaultTech.id,
            reassignedToTechnicianName: `${defaultTech.firstName} ${defaultTech.lastName}`.trim(),
          },
        });
      } catch (logErr) {
        this.logger.warn(`Failed to log deactivation audit entry for user ${id}: ${logErr.message}`);
      }

      this.logger.log(`Technician deactivated: ${updated.email} (${updated.id}) with ${pendingProcesses.length} processes reassigned`);
      return updated;
    }

    // 5. Standard update (name, phone, branch, or status other than INACTIVE)
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(branchId && { branchId }),
        ...(status && { status }),
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultTechnicianId: true,
          },
        },
      },
    });

    this.logger.log(`Technician updated: ${updated.email} (${updated.id})`);
    return updated;
  }

  /**
   * Permanent user deletion is restricted for all users.
   */
  async remove(tenantId: string, id: string, branchIdContext?: string | null) {
    throw new BadRequestException(
      'Permanent user deletion is restricted. Please mark the technician as inactive instead.',
    );
  }
}
