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

  @Get(':id')
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
    const branchContext = userRole === 'ADMIN' ? branchIdContext : null;
    return this.workOrdersService.findOne(tenantId, id, branchContext);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a work order' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkOrderDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const branchContext = userRole === 'ADMIN' ? branchIdContext : null;
    return this.workOrdersService.update(tenantId, id, dto, branchContext);
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
}
