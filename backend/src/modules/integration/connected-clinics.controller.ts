import { Controller, Get, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles, CurrentUser } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Connected Clinics')
@ApiBearerAuth()
@Controller('connected-clinics')
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class ConnectedClinicsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List connected clinics and their details' })
  async getConnectedClinics(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }

    return this.prisma.clinic.findMany({
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
  }
}
