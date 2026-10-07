import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole, WorkOrderStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { Roles, CurrentUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateClinicProsthesisTypesDto } from './dto';

@ApiTags('Connected Clinics')
@ApiBearerAuth()
@Controller('connected-clinics')
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class ConnectedClinicsController {
  private readonly logger = new Logger(ConnectedClinicsController.name);

  constructor(private readonly prisma: PrismaService) {}

  private async ensurePriceColumnExists() {
    try {
      await this.prisma.$executeRawUnsafe(
        `ALTER TABLE "clinic_prosthesis_types" ADD COLUMN IF NOT EXISTS "price" DOUBLE PRECISION;`,
      );
    } catch {
      // Column may already exist or ALTER not allowed
    }
  }

  private async getClinicProsthesisTypes(clinicId: string) {
    try {
      await this.ensurePriceColumnExists();
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT pt.id, pt.name, pt.description, pt.price AS common_price, cpt.price AS clinic_price
         FROM "prosthesis_types" pt
         INNER JOIN "clinic_prosthesis_types" cpt ON cpt.prosthesis_type_id = pt.id
         WHERE cpt.clinic_id = $1
         ORDER BY pt.name ASC`,
        clinicId,
      );
      return (rows || []).map((row) => {
        const commonPrice =
          row.common_price !== null && row.common_price !== undefined
            ? Number(row.common_price)
            : 0;
        const clinicPrice =
          row.clinic_price !== null && row.clinic_price !== undefined
            ? Number(row.clinic_price)
            : commonPrice;
        return {
          prosthesisType: {
            id: row.id,
            name: row.name,
            description: row.description,
            price: commonPrice,
          },
          price: clinicPrice,
        };
      });
    } catch (e) {
      this.logger.error('Error in getClinicProsthesisTypes:', e);
      return [];
    }
  }

  @Get()
  @ApiOperation({ summary: 'List connected clinics and their details' })
  async getConnectedClinics(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }

    const clinics = await this.prisma.clinic.findMany({
      where: {
        tenantId,
        ...(branchIdContext ? { branchId: branchIdContext } : {}),
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        doctors: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            workOrders: {
              select: {
                id: true,
                folioNumber: true,
                patient: true,
                status: true,
                totalQuote: true,
                initialPayment: true,
                deliveryDate: true,
                createdAt: true,
                prosthesisType: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      clinics.map(async (c) => {
        let totalQuoted = 0;
        let totalCollected = 0;
        let totalPending = 0;

        for (const doc of c.doctors) {
          for (const wo of doc.workOrders) {
            const quote = wo.totalQuote || 0;
            const collected = wo.initialPayment || 0;
            totalQuoted += quote;
            totalCollected += collected;
            if (wo.status !== WorkOrderStatus.CANCELLED) {
              totalPending += Math.max(0, quote - collected);
            }
          }
        }

        return {
          ...c,
          totalQuoted,
          totalCollected,
          totalPending,
          allowedProsthesisTypes: await this.getClinicProsthesisTypes(c.id),
        };
      }),
    );
  }

  @Get(':id/work-orders')
  @ApiOperation({ summary: 'List work orders for a connected clinic' })
  async getClinicWorkOrders(
    @Param('id') clinicId: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }

    const clinic = await this.prisma.clinic.findFirst({
      where: {
        id: clinicId,
        tenantId,
        ...(branchIdContext ? { branchId: branchIdContext } : {}),
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!clinic) {
      throw new NotFoundException('Clinic not found or access denied.');
    }

    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        tenantId,
        doctor: {
          clinicId,
        },
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        prosthesisType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = workOrders.map((wo) => {
      const quote = wo.totalQuote || 0;
      const collected = wo.initialPayment || 0;
      const pending =
        wo.status === WorkOrderStatus.CANCELLED
          ? 0
          : Math.max(0, quote - collected);
      return {
        id: wo.id,
        folioNumber: wo.folioNumber,
        patient: wo.patient,
        status: wo.status,
        totalQuote: wo.totalQuote,
        initialPayment: wo.initialPayment,
        collectedAmount: collected,
        pendingAmount: pending,
        deliveryDate: wo.deliveryDate,
        createdAt: wo.createdAt,
        doctor: wo.doctor,
        prosthesisType: wo.prosthesisType,
      };
    });

    const summary = enriched.reduce(
      (acc, wo) => {
        acc.totalOrders += 1;
        acc.totalQuote += wo.totalQuote || 0;
        acc.totalCollected += wo.collectedAmount;
        acc.totalPending += wo.pendingAmount;
        return acc;
      },
      { totalOrders: 0, totalQuote: 0, totalCollected: 0, totalPending: 0 },
    );

    return {
      clinic: {
        id: clinic.id,
        name: clinic.name,
        url: clinic.url,
        branch: clinic.branch,
      },
      summary,
      workOrders: enriched,
    };
  }

  @Put(':id/prosthesis-types')
  @ApiOperation({
    summary: 'Update allowed prosthesis types for a connected clinic',
  })
  async updateClinicProsthesisTypes(
    @Param('id') clinicId: string,
    @Body() dto: UpdateClinicProsthesisTypesDto,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }

    const clinic = await this.prisma.clinic.findFirst({
      where: {
        id: clinicId,
        tenantId,
        ...(branchIdContext ? { branchId: branchIdContext } : {}),
      },
    });

    if (!clinic) {
      throw new NotFoundException('Clinic not found or access denied.');
    }

    let itemsToSave: { prosthesisTypeId: string; price?: number }[] = [];
    if (dto.items && dto.items.length > 0) {
      itemsToSave = dto.items;
    } else if (dto.prosthesisTypeIds && dto.prosthesisTypeIds.length > 0) {
      itemsToSave = dto.prosthesisTypeIds.map((id) => ({
        prosthesisTypeId: id,
      }));
    }

    const typeIds = itemsToSave.map((item) => item.prosthesisTypeId);

    if (typeIds.length > 0) {
      const count = await this.prisma.prosthesisType.count({
        where: {
          id: { in: typeIds },
          tenantId,
        },
      });

      if (count !== typeIds.length) {
        throw new BadRequestException(
          'One or more invalid prosthesis type IDs provided.',
        );
      }
    }

    try {
      await this.ensurePriceColumnExists();

      // Delete existing assignments for clinic
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM "clinic_prosthesis_types" WHERE "clinic_id" = $1`,
        clinicId,
      );

      // Insert new assignments with node-generated UUID
      for (const item of itemsToSave) {
        const id = randomUUID();
        if (item.price !== undefined && item.price !== null) {
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO "clinic_prosthesis_types" ("id", "clinic_id", "prosthesis_type_id", "price", "created_at")
             VALUES ($1, $2, $3, $4, NOW())`,
            id,
            clinicId,
            item.prosthesisTypeId,
            item.price,
          );
        } else {
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO "clinic_prosthesis_types" ("id", "clinic_id", "prosthesis_type_id", "created_at")
             VALUES ($1, $2, $3, NOW())`,
            id,
            clinicId,
            item.prosthesisTypeId,
          );
        }
      }
    } catch (e: any) {
      this.logger.error(
        `Failed to update clinic prosthesis types for clinic ${clinicId}:`,
        e.stack || e,
      );
      throw new InternalServerErrorException(
        'Failed to save clinic prosthesis types: ' +
          (e.message || 'Database error'),
      );
    }

    const updatedClinic = await this.prisma.clinic.findUnique({
      where: { id: clinicId },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        doctors: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            workOrders: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!updatedClinic) {
      throw new NotFoundException('Clinic not found after update.');
    }

    return {
      ...updatedClinic,
      allowedProsthesisTypes: await this.getClinicProsthesisTypes(clinicId),
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Delete a connected clinic and its associated doctors, work orders, and clinic pricing',
  })
  async deleteConnectedClinic(
    @Param('id') clinicId: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }

    const clinic = await this.prisma.clinic.findFirst({
      where: {
        id: clinicId,
        tenantId,
        ...(branchIdContext ? { branchId: branchIdContext } : {}),
      },
      include: {
        doctors: {
          select: { id: true },
        },
      },
    });

    if (!clinic) {
      throw new NotFoundException('Clinic not found or access denied.');
    }

    const doctorIds = clinic.doctors.map((d) => d.id);

    await this.prisma.$transaction(async (tx) => {
      // 1. Delete doctors belonging specifically to this clinic.
      // This cascades in PostgreSQL to their work orders, doctor lists, notes, rework logs, etc.
      if (doctorIds.length > 0) {
        await tx.doctor.deleteMany({
          where: {
            id: { in: doctorIds },
            tenantId,
          },
        });
      }

      // 2. Delete clinic-specific prosthesis pricing records (master prosthesis types remain untouched)
      await tx.clinicProsthesisType.deleteMany({
        where: { clinicId: clinic.id },
      });

      // 3. Delete the clinic entity
      await tx.clinic.delete({
        where: { id: clinic.id },
      });
    });

    this.logger.log(
      `Connected clinic "${clinic.name}" (${clinic.id}) deleted with ${doctorIds.length} doctors and their work orders by tenant ${tenantId}`,
    );

    return {
      success: true,
      message:
        'Clinic, assigned clinic pricing, and associated doctors/work orders deleted successfully',
    };
  }
}
