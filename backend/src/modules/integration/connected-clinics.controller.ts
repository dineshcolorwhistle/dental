import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles, CurrentUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateClinicProsthesisTypesDto } from './dto';

@ApiTags('Connected Clinics')
@ApiBearerAuth()
@Controller('connected-clinics')
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class ConnectedClinicsController {
  constructor(private readonly prisma: PrismaService) {}

  private async getClinicProsthesisTypes(clinicId: string) {
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT pt.id, pt.name, pt.description 
         FROM "prosthesis_types" pt
         INNER JOIN "clinic_prosthesis_types" cpt ON cpt.prosthesis_type_id = pt.id
         WHERE cpt.clinic_id = $1
         ORDER BY pt.name ASC`,
        clinicId,
      );
      return (rows || []).map((row) => ({
        prosthesisType: {
          id: row.id,
          name: row.name,
          description: row.description,
        },
      }));
    } catch {
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

    if (dto.prosthesisTypeIds.length > 0) {
      const count = await this.prisma.prosthesisType.count({
        where: {
          id: { in: dto.prosthesisTypeIds },
          tenantId,
        },
      });

      if (count !== dto.prosthesisTypeIds.length) {
        throw new BadRequestException(
          'One or more invalid prosthesis type IDs provided.',
        );
      }
    }

    // Delete existing assignments for clinic
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "clinic_prosthesis_types" WHERE "clinic_id" = $1`,
      clinicId,
    );

    // Insert new assignments
    for (const prosthesisTypeId of dto.prosthesisTypeIds) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "clinic_prosthesis_types" ("id", "clinic_id", "prosthesis_type_id", "created_at")
         VALUES (gen_random_uuid(), $1, $2, NOW())
         ON CONFLICT DO NOTHING`,
        clinicId,
        prosthesisTypeId,
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
