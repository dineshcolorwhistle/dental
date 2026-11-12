import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { OdontogramService } from './odontogram.service';
import {
  UpdateOdontogramConfigDto,
  CreateOdontogramTreatmentDto,
  UpdateOdontogramTreatmentDto,
  CreateOdontogramDiagnosticDto,
  UpdateOdontogramDiagnosticDto,
  SaveWorkOrderOdontogramDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Odontogram')
@ApiBearerAuth()
@Controller('odontogram')
export class OdontogramController {
  constructor(private readonly odontogramService: OdontogramService) {}

  // ─── Config Endpoints ────────────────────────────────────

  @Get('config')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Get odontogram default configuration' })
  async getConfig(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Query('branchId') branchIdFilter?: string,
  ) {
    const resolvedTenantId = await this.odontogramService.resolveTenantId(
      tenantId,
      userRole,
    );
    const branchId =
      userRole === UserRole.ADMIN || userRole === UserRole.TECHNICIAN ? branchIdContext || undefined : branchIdFilter;
    return this.odontogramService.getConfig(resolvedTenantId, branchId);
  }

  @Put('config')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update default odontogram configuration' })
  async updateConfig(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Body() dto: UpdateOdontogramConfigDto,
  ) {
    const resolvedTenantId = await this.odontogramService.resolveTenantId(
      tenantId,
      userRole,
    );
    return this.odontogramService.updateConfig(
      resolvedTenantId,
      branchIdContext,
      userRole,
      dto,
    );
  }

  // ─── Treatments Endpoints ────────────────────────────────

  @Get('treatments')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'List all treatments' })
  async findAllTreatments(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Query('branchId') branchIdFilter?: string,
  ) {
    const resolvedTenantId = await this.odontogramService.resolveTenantId(
      tenantId,
      userRole,
    );
    const branchId =
      userRole === UserRole.ADMIN || userRole === UserRole.TECHNICIAN ? branchIdContext || undefined : branchIdFilter;
    return this.odontogramService.findAllTreatments(resolvedTenantId, branchId);
  }

  @Post('treatments')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new odontogram treatment' })
  async createTreatment(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Body() dto: CreateOdontogramTreatmentDto,
  ) {
    const resolvedTenantId = await this.odontogramService.resolveTenantId(
      tenantId,
      userRole,
    );
    return this.odontogramService.createTreatment(
      resolvedTenantId,
      branchIdContext,
      userRole,
      dto,
    );
  }

  @Patch('treatments/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an odontogram treatment' })
  async updateTreatment(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
    @Body() dto: UpdateOdontogramTreatmentDto,
  ) {
    const resolvedTenantId = await this.odontogramService.resolveTenantId(
      tenantId,
      userRole,
    );
    return this.odontogramService.updateTreatment(
      resolvedTenantId,
      id,
      branchIdContext,
      userRole,
      dto,
    );
  }

  @Delete('treatments/:id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an odontogram treatment' })
  async removeTreatment(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
  ) {
    const resolvedTenantId = await this.odontogramService.resolveTenantId(
      tenantId,
      userRole,
    );
    return this.odontogramService.removeTreatment(resolvedTenantId, id);
  }

  // ─── Diagnostics Endpoints ───────────────────────────────

  @Get('diagnostics')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'List all diagnostics' })
  async findAllDiagnostics(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Query('branchId') branchIdFilter?: string,
  ) {
    const resolvedTenantId = await this.odontogramService.resolveTenantId(
      tenantId,
      userRole,
    );
    const branchId =
      userRole === UserRole.ADMIN || userRole === UserRole.TECHNICIAN ? branchIdContext || undefined : branchIdFilter;
    return this.odontogramService.findAllDiagnostics(resolvedTenantId, branchId);
  }

  @Post('diagnostics')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new odontogram diagnostic entry' })
  async createDiagnostic(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Body() dto: CreateOdontogramDiagnosticDto,
  ) {
    const resolvedTenantId = await this.odontogramService.resolveTenantId(
      tenantId,
      userRole,
    );
    return this.odontogramService.createDiagnostic(
      resolvedTenantId,
      branchIdContext,
      userRole,
      dto,
    );
  }

  @Patch('diagnostics/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an odontogram diagnostic entry' })
  async updateDiagnostic(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
    @Body() dto: UpdateOdontogramDiagnosticDto,
  ) {
    const resolvedTenantId = await this.odontogramService.resolveTenantId(
      tenantId,
      userRole,
    );
    return this.odontogramService.updateDiagnostic(
      resolvedTenantId,
      id,
      branchIdContext,
      userRole,
      dto,
    );
  }

  @Delete('diagnostics/:id')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an odontogram diagnostic entry' })
  async removeDiagnostic(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
  ) {
    const resolvedTenantId = await this.odontogramService.resolveTenantId(
      tenantId,
      userRole,
    );
    return this.odontogramService.removeDiagnostic(resolvedTenantId, id);
  }

  // ─── Work Order Odontogram Endpoints ─────────────────────

  @Get('work-order/:workOrderId')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Get odontogram data for a specific work order' })
  async getWorkOrderOdontogram(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('role') userRole: string,
    @Param('workOrderId') workOrderId: string,
  ) {
    const resolvedTenantId = await this.odontogramService.resolveTenantId(
      tenantId,
      userRole,
    );
    return this.odontogramService.getWorkOrderOdontogram(
      resolvedTenantId,
      workOrderId,
    );
  }

  @Put('work-order/:workOrderId')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.TECHNICIAN)
  @ApiOperation({ summary: 'Save or update odontogram data for a work order' })
  async saveWorkOrderOdontogram(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('role') userRole: string,
    @Param('workOrderId') workOrderId: string,
    @Body() dto: SaveWorkOrderOdontogramDto,
  ) {
    const resolvedTenantId = await this.odontogramService.resolveTenantId(
      tenantId,
      userRole,
    );
    return this.odontogramService.saveWorkOrderOdontogram(
      resolvedTenantId,
      workOrderId,
      dto,
    );
  }

  @Delete('work-order/:workOrderId')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN, UserRole.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset odontogram data for a work order' })
  async deleteWorkOrderOdontogram(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('role') userRole: string,
    @Param('workOrderId') workOrderId: string,
  ) {
    const resolvedTenantId = await this.odontogramService.resolveTenantId(
      tenantId,
      userRole,
    );
    return this.odontogramService.deleteWorkOrderOdontogram(
      resolvedTenantId,
      workOrderId,
    );
  }
}

