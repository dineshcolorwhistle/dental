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
import { ExpensesService } from './expenses.service';
import { CreateExpenseCategoryDto, CreateExpenseDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Expenses')
@ApiBearerAuth()
@Controller('expenses')
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  // ─── Expense Categories ───────────────────────────────────

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new expense category' })
  async createCategory(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.expensesService.createCategory(tenantId, dto);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List all expense categories' })
  async findAllCategories(@CurrentUser('tenantId') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.expensesService.findAllCategories(tenantId);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update an expense category' })
  async updateCategory(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.expensesService.updateCategory(tenantId, id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an expense category' })
  async removeCategory(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.expensesService.removeCategory(tenantId, id);
  }

  // ─── Expenses ─────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new expense' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Body() dto: CreateExpenseDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.expensesService.createExpense(tenantId, branchIdContext, userRole, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all expenses' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Query('branchId') branchId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.expensesService.findAllExpenses(tenantId, branchIdContext, userRole, {
      branchId,
      categoryId,
      startDate,
      endDate,
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an expense details' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.expensesService.findOneExpense(tenantId, id, branchIdContext);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an expense' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
    @Body() dto: CreateExpenseDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.expensesService.updateExpense(tenantId, id, branchIdContext, userRole, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an expense' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.expensesService.removeExpense(tenantId, id, branchIdContext, userRole);
  }
}
