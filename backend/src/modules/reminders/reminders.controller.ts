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
import { UserRole, ReminderStatus } from '@prisma/client';
import { RemindersService } from './reminders.service';
import { CreateReminderDto, UpdateReminderDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Reminders')
@ApiBearerAuth()
@Controller('reminders')
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new reminder (ADMIN only)' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: CreateReminderDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.remindersService.create(tenantId, branchId, userId, role, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all reminders' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchId: string | null,
    @CurrentUser('role') role: UserRole,
    @Query('search') search?: string,
    @Query('priority') priority?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('recurrence') recurrence?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.remindersService.findAll(tenantId, branchId, role, {
      search,
      priority,
      status,
      category,
      recurrence,
      dateFrom,
      dateTo,
    });
  }

  @Get('assignable-users')
  @ApiOperation({
    summary: 'Get users assignable to reminders (excludes OWNER)',
  })
  async getAssignableUsers(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchId: string | null,
    @Query('branchId') queryBranchId?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    const resolvedBranchId = queryBranchId || branchId || undefined;
    return this.remindersService.getAssignableUsers(tenantId, resolvedBranchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single reminder by ID' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.remindersService.findOne(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a reminder (ADMIN only)' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
    @Body() dto: UpdateReminderDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.remindersService.update(tenantId, id, role, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update reminder status' })
  async updateStatus(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body('status') status: ReminderStatus,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    if (!status || !Object.values(ReminderStatus).includes(status)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${Object.values(ReminderStatus).join(', ')}`,
      );
    }
    return this.remindersService.updateStatus(tenantId, id, status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a reminder (OWNER only)' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.remindersService.remove(tenantId, id, role);
  }
}
