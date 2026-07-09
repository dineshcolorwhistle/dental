import {
  Controller,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { Public } from '../../common/decorators';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Integration endpoints consumed by the external Doctor Portal.
 * All routes are guarded by the ApiKeyGuard (X-API-Key header).
 * They bypass the global JWT and Roles guards via @Public().
 */
@ApiTags('Integration')
@Controller('integration')
@Public() // Bypass JWT auth — these endpoints use API key auth instead
@UseGuards(ApiKeyGuard)
export class IntegrationController {
  constructor(private readonly prisma: PrismaService) {}

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
}
