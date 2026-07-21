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
import { ProcessAreasService } from './process-areas.service';
import { CreateProcessAreaDto, UpdateProcessAreaDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Process Areas')
@ApiBearerAuth()
@Controller('process-areas')
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class ProcessAreasController {
  constructor(private readonly processAreasService: ProcessAreasService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new process area' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Body() dto: CreateProcessAreaDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.processAreasService.create(tenantId, branchIdContext, userRole, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all process areas' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Query('branchId') branchIdFilter?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }

    // For branch admin, implicitly force branch scoping
    if (userRole === 'ADMIN') {
      return this.processAreasService.findAll(
        tenantId,
        branchIdContext || undefined,
      );
    }

    // For owner, use query filter if provided
    return this.processAreasService.findAll(tenantId, branchIdFilter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific process area' })
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
    return this.processAreasService.findOne(
      tenantId,
      id,
      branchContext || undefined,
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update details of a specific process area' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
    @Body() dto: UpdateProcessAreaDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const branchContext = userRole === 'ADMIN' ? branchIdContext : null;
    return this.processAreasService.update(
      tenantId,
      id,
      dto,
      branchContext || undefined,
    );
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a process area record' })
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
    return this.processAreasService.remove(
      tenantId,
      id,
      branchContext || undefined,
    );
  }
}
