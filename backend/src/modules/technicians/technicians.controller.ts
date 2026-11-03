import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { TechniciansService } from './technicians.service';
import { CreateTechnicianDto, UpdateTechnicianDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Technicians')
@ApiBearerAuth()
@Controller('technicians')
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a new technician user' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Body() dto: CreateTechnicianDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.techniciansService.create(
      tenantId,
      branchIdContext,
      userRole,
      dto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List all technicians' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Query('branchId') branchIdFilter?: string,
    @Query('includeAdmins') includeAdmins?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }

    const shouldIncludeAdmins = includeAdmins === 'true';

    // For branch admin, implicitly force branch scoping
    if (userRole === 'ADMIN') {
      return this.techniciansService.findAll(
        tenantId,
        branchIdContext || undefined,
        shouldIncludeAdmins,
      );
    }

    // For owner, use query filter if provided
    return this.techniciansService.findAll(
      tenantId,
      branchIdFilter,
      shouldIncludeAdmins,
    );
  }

  @Get(':id/inactivation-check')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Check if a technician can be safely inactivated' })
  async checkInactivation(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const branchContext = userRole === 'ADMIN' ? branchIdContext : null;
    return this.techniciansService.checkInactivation(tenantId, id, branchContext);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific technician' })
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
    return this.techniciansService.findOne(tenantId, id, branchContext);
  }

  @Patch(':id/set-default')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Designate a technician as the default technician for their branch' })
  async setDefaultTechnician(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    if (!branchIdContext) {
      throw new BadRequestException('Branch context is required for administrators.');
    }
    return this.techniciansService.setDefaultTechnician(
      tenantId,
      branchIdContext,
      id,
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Update a specific technician's details" })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
    @Body() dto: UpdateTechnicianDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const branchContext = userRole === 'ADMIN' ? branchIdContext : null;
    return this.techniciansService.update(
      tenantId,
      id,
      dto,
      branchContext,
      userId,
    );
  }
}
