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
import { ProsthesisTypesService } from './prosthesis-types.service';
import {
  CreateProsthesisTypeDto,
  UpdateProsthesisTypeDto,
  ReorderProsthesisTypeProcessesDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Prosthesis Types')
@ApiBearerAuth()
@Controller('prosthesis-types')
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class ProsthesisTypesController {
  constructor(
    private readonly prosthesisTypesService: ProsthesisTypesService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new prosthesis/work type' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Body() dto: CreateProsthesisTypeDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.prosthesisTypesService.create(
      tenantId,
      branchIdContext,
      userRole,
      dto,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'List all prosthesis/work types' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Query('branchId') branchIdFilter?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }

    // For branch admin or technician, implicitly force branch scoping
    if (userRole === 'ADMIN' || userRole === 'TECHNICIAN') {
      return this.prosthesisTypesService.findAll(
        tenantId,
        branchIdContext || undefined,
      );
    }

    // For owner, use query filter if provided
    return this.prosthesisTypesService.findAll(tenantId, branchIdFilter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific prosthesis type' })
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
    return this.prosthesisTypesService.findOne(tenantId, id, branchContext);
  }

  @Get(':id/processes')
  @ApiOperation({
    summary: 'Get processes assigned to a prosthesis type in sequence order',
  })
  async getProcesses(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.prosthesisTypesService.getProcesses(tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a prosthesis type' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
    @Body() dto: UpdateProsthesisTypeDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const branchContext = userRole === 'ADMIN' ? branchIdContext : null;
    return this.prosthesisTypesService.update(tenantId, id, dto, branchContext);
  }

  @Post(':id/reorder-processes')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder process sequence for a prosthesis type' })
  async reorderProcesses(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: ReorderProsthesisTypeProcessesDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.prosthesisTypesService.reorderProcesses(
      tenantId,
      id,
      dto.processIds,
    );
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a prosthesis type' })
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
    return this.prosthesisTypesService.remove(tenantId, id, branchContext);
  }
}
