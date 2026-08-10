import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
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
                status: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      clinics.map(async (c) => ({
        ...c,
        allowedProsthesisTypes: await this.getClinicProsthesisTypes(c.id),
      })),
    );
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
}
