import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { WorkOrdersService } from './work-orders.service';
import { CreateWorkOrderDto, UpdateWorkOrderDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Work Orders')
@ApiBearerAuth()
@Controller('work-orders')
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new work order' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Body() dto: CreateWorkOrderDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.workOrdersService.create(tenantId, branchIdContext, userId, userRole, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all work orders' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Query('branchId') branchIdFilter?: string,
    @Query('status') statusFilter?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }

    // For branch admin, force branch scoping
    if (userRole === 'ADMIN') {
      return this.workOrdersService.findAll(tenantId, branchIdContext || undefined, statusFilter);
    }

    // For owner, use query filter if provided
    return this.workOrdersService.findAll(tenantId, branchIdFilter, statusFilter);
  }

  @Get('next-folio')
  @ApiOperation({ summary: 'Get the next auto-generated folio number for a branch' })
  async getNextFolio(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Query('branchId') branchIdQuery?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const finalBranchId = userRole === 'ADMIN' ? branchIdContext : branchIdQuery;
    if (!finalBranchId) {
      throw new BadRequestException('Branch ID is required.');
    }
    return this.workOrdersService.getNextFolioNumber(tenantId, finalBranchId);
  }

  @Get('dashboard-stats')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({ summary: 'Get operational dashboard statistics' })
  async getDashboardStats(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const finalBranchId = userRole === 'ADMIN' ? branchIdContext : null;
    return this.workOrdersService.getDashboardStats(tenantId, finalBranchId);
  }

  @Get('qr/:token')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.DELIVERY)
  @ApiOperation({ summary: 'Get details of a specific work order by QR token' })
  async findOneByQrToken(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('token') token: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const branchContext = (userRole === 'ADMIN' || userRole === 'TECHNICIAN' || userRole === 'DELIVERY') ? branchIdContext : null;
    return this.workOrdersService.findOneByQrToken(tenantId, token, branchContext, userRole);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.DELIVERY)
  @ApiOperation({ summary: 'Get details of a specific work order' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const branchContext = (userRole === 'ADMIN' || userRole === 'TECHNICIAN' || userRole === 'DELIVERY') ? branchIdContext : null;
    return this.workOrdersService.findOne(tenantId, id, branchContext, userRole);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a work order' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkOrderDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const branchContext = userRole === 'ADMIN' ? branchIdContext : null;
    return this.workOrdersService.update(tenantId, id, dto, branchContext, userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a work order' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const branchContext = userRole === 'ADMIN' ? branchIdContext : null;
    return this.workOrdersService.remove(tenantId, id, branchContext);
  }

  @Post(':id/processes/:processId/start-verification')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Start process step verification' })
  async startVerification(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
    @Param('processId') processId: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    if (userRole === 'ADMIN') {
      const wo = await this.workOrdersService.findOne(tenantId, id, branchIdContext);
      if (!wo) {
        throw new BadRequestException('Work order not found in your branch context.');
      }
    }
    return this.workOrdersService.startVerification(tenantId, id, processId, userId);
  }

  @Post(':id/processes/:processId/end-verification')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'End process step verification with SUCCESS, REWORK, or REPETITION' })
  async endVerification(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
    @Param('processId') processId: string,
    @Body() body: { status: 'SUCCESS' | 'REWORK' | 'REPETITION' },
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    if (!body || !body.status || !['SUCCESS', 'REWORK', 'REPETITION'].includes(body.status)) {
      throw new BadRequestException('Outcome status must be SUCCESS, REWORK, or REPETITION.');
    }
    if (userRole === 'ADMIN') {
      const wo = await this.workOrdersService.findOne(tenantId, id, branchIdContext);
      if (!wo) {
        throw new BadRequestException('Work order not found in your branch context.');
      }
    }
    return this.workOrdersService.endVerification(tenantId, id, processId, body.status, userId);
  }
}
