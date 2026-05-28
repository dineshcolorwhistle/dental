import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { TechnicianPortalService } from './technician-portal.service';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Technician Portal')
@ApiBearerAuth()
@Controller('technician-portal')
@Roles(UserRole.TECHNICIAN)
export class TechnicianPortalController {
  constructor(private readonly portalService: TechnicianPortalService) {}

  @Get('dashboard-stats')
  @ApiOperation({ summary: 'Get queue metrics for the technician' })
  async getDashboardStats(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.portalService.getDashboardStats(tenantId, userId);
  }

  @Get('work-orders')
  @ApiOperation({ summary: 'List all assigned work orders for the technician' })
  async getAssignedWorkOrders(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Query('status') statusFilter?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.portalService.getAssignedWorkOrders(tenantId, userId, statusFilter);
  }

  @Get('work-orders/:id')
  @ApiOperation({ summary: 'Get details of an assigned work order' })
  async getWorkOrderDetail(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.portalService.getWorkOrderDetail(tenantId, userId, id);
  }

  @Post('processes/:processId/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a process step' })
  async startProcess(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('processId') processId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.portalService.startProcess(tenantId, userId, processId);
  }

  @Post('processes/:processId/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause a process step' })
  async pauseProcess(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('processId') processId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.portalService.pauseProcess(tenantId, userId, processId);
  }

  @Post('processes/:processId/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a process step' })
  async resumeProcess(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('processId') processId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.portalService.resumeProcess(tenantId, userId, processId);
  }

  @Post('processes/:processId/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End and complete a process step' })
  async endProcess(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('processId') processId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.portalService.endProcess(tenantId, userId, processId);
  }
}
