import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole, UserStatus } from '@prisma/client';
import { CreateInterestRequestDto, InterestRequestStatus } from './dto';

@Injectable()
export class InterestRequestsService {
  private readonly logger = new Logger(InterestRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Get public work order details by QR token (sanitized, non-sensitive).
   */
  async getPublicWorkOrderByQrToken(token: string) {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { qrToken: token },
      select: {
        id: true,
        folioNumber: true,
        patient: true,
        boxNumber: true,
        color: true,
        status: true,
        specification: true,
        createdAt: true,
        tenantId: true,
        tenant: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
        doctor: {
          select: {
            name: true,
            clinicName: true,
          },
        },
        prosthesisType: {
          select: {
            name: true,
          },
        },
        processes: {
          select: {
            id: true,
            processName: true,
            status: true,
            sequence: true,
            isVerification: true,
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    return workOrder;
  }

  /**
   * Create a new interest request (public submission).
   */
  async create(dto: CreateInterestRequestDto) {
    const prisma = this.prisma as any;
    if (!prisma.interestRequest) {
      this.logger.warn(
        'PrismaClient does not have interestRequest delegate. Please run npx prisma generate.',
      );
      throw new BadRequestException(
        'Interest request module is initializing. Please try again.',
      );
    }

    const interestRequest = await prisma.interestRequest.create({
      data: {
        tenantId: dto.tenantId,
        workOrderId: dto.workOrderId || null,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        notes: dto.notes || null,
        status: InterestRequestStatus.PENDING,
      },
      include: {
        workOrder: {
          select: {
            folioNumber: true,
            patient: true,
          },
        },
      },
    });

    // Find the folio number for notification message
    const folioNumber = interestRequest.workOrder?.folioNumber || 'N/A';

    // Send notifications to all SUPER_ADMIN users
    const superAdmins = await this.prisma.user.findMany({
      where: {
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    for (const admin of superAdmins) {
      await this.notificationsService.create({
        tenantId: dto.tenantId,
        userId: admin.id,
        title: 'New Interest Request',
        message: `New interest request from "${dto.name}" for WO "${folioNumber}".`,
        type: 'INTEREST_REQUEST',
        referenceId: interestRequest.id,
      });
    }

    this.logger.log(
      `Interest request created: ${interestRequest.id} by ${dto.name} (${dto.email})`,
    );

    return interestRequest;
  }

  /**
   * List all interest requests (admin view) with tenant scoping.
   */
  async findAll(
    tenantId: string | null,
    userRole: string,
    statusFilter?: string,
    searchQuery?: string,
  ) {
    const prisma = this.prisma as any;
    if (!prisma.interestRequest) {
      this.logger.warn(
        'PrismaClient does not have interestRequest delegate. Please run npx prisma generate.',
      );
      return [];
    }

    try {
      const where: any = {};

      // SUPER_ADMIN sees all; OWNER/ADMIN scoped to their tenant
      if (userRole !== 'SUPER_ADMIN' && tenantId) {
        where.tenantId = tenantId;
      }

      if (statusFilter && statusFilter !== 'ALL') {
        where.status = statusFilter;
      }

      if (searchQuery) {
        where.OR = [
          { name: { contains: searchQuery, mode: 'insensitive' } },
          { email: { contains: searchQuery, mode: 'insensitive' } },
          { phone: { contains: searchQuery, mode: 'insensitive' } },
        ];
      }

      return await prisma.interestRequest.findMany({
        where,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
          workOrder: {
            select: {
              id: true,
              folioNumber: true,
              patient: true,
              doctor: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error: any) {
      this.logger.error(
        `Error in InterestRequestsService.findAll: ${error?.message || error}`,
        error?.stack,
      );
      return [];
    }
  }

  /**
   * Update the status of an interest request.
   */
  async updateStatus(id: string, status: InterestRequestStatus) {
    const prisma = this.prisma as any;
    if (!prisma.interestRequest) {
      throw new BadRequestException('Interest request module is initializing.');
    }
    return prisma.interestRequest.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Delete an interest request.
   */
  async remove(id: string) {
    const prisma = this.prisma as any;
    if (!prisma.interestRequest) {
      throw new BadRequestException('Interest request module is initializing.');
    }
    await prisma.interestRequest.delete({
      where: { id },
    });
    return { success: true };
  }
}
