import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseCategoryDto, CreateExpenseDto } from './dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Expense Categories ───────────────────────────────────

  async createCategory(tenantId: string, dto: CreateExpenseCategoryDto) {
    const { name, description } = dto;

    // Check if category name already exists for this tenant
    const existing = await this.prisma.expenseCategory.findFirst({
      where: {
        tenantId,
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(`Expense category "${name}" already exists.`);
    }

    return this.prisma.expenseCategory.create({
      data: {
        tenantId,
        name,
        description,
      },
    });
  }

  async findAllCategories(tenantId: string) {
    return this.prisma.expenseCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async updateCategory(tenantId: string, id: string, dto: CreateExpenseCategoryDto) {
    const { name, description } = dto;

    const category = await this.prisma.expenseCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      throw new NotFoundException(`Expense category not found.`);
    }

    // Check name conflict
    const existing = await this.prisma.expenseCategory.findFirst({
      where: {
        tenantId,
        name: { equals: name, mode: 'insensitive' },
        id: { not: id },
      },
    });

    if (existing) {
      throw new ConflictException(`Expense category "${name}" already exists.`);
    }

    return this.prisma.expenseCategory.update({
      where: { id },
      data: { name, description },
    });
  }

  async removeCategory(tenantId: string, id: string) {
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      throw new NotFoundException(`Expense category not found.`);
    }

    // Check if category is in use by expenses
    const inUse = await this.prisma.expense.count({
      where: { categoryId: id },
    });

    if (inUse > 0) {
      throw new BadRequestException('Cannot delete category because it is in use by expenses.');
    }

    return this.prisma.expenseCategory.delete({
      where: { id },
    });
  }

  // ─── Expenses ─────────────────────────────────────────────

  async createExpense(
    tenantId: string,
    branchIdContext: string | null,
    userRole: string,
    dto: CreateExpenseDto,
  ) {
    const { title, description, amount, date, paymentMethod, categoryId, branchId } = dto;

    // Resolve and enforce branch ID based on role
    let finalBranchId = branchId;
    if (userRole === 'ADMIN') {
      if (!branchIdContext) {
        throw new BadRequestException('Branch context is required for administrators.');
      }
      finalBranchId = branchIdContext;
    }

    // Verify category exists in this tenant
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id: categoryId, tenantId },
    });
    if (!category) {
      throw new NotFoundException(`Expense category not found.`);
    }

    // Verify branch belongs to tenant if specified
    if (finalBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: finalBranchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundException(`Branch not found in this organization.`);
      }
    }

    return this.prisma.expense.create({
      data: {
        tenantId,
        branchId: finalBranchId || null,
        categoryId,
        title,
        description,
        amount,
        date: new Date(date),
        paymentMethod,
      },
      include: {
        category: true,
        branch: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findAllExpenses(
    tenantId: string,
    branchIdContext: string | null,
    userRole: string,
    filters: {
      branchId?: string;
      categoryId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
  ) {
    // Restrict ADMIN queries to their own branch
    let finalBranchId = filters.branchId;
    if (userRole === 'ADMIN') {
      finalBranchId = branchIdContext || undefined;
    }

    return this.prisma.expense.findMany({
      where: {
        tenantId,
        ...(finalBranchId && finalBranchId !== 'ALL' && { branchId: finalBranchId }),
        ...(filters.categoryId && filters.categoryId !== 'ALL' && { categoryId: filters.categoryId }),
        ...(filters.startDate && filters.endDate && {
          date: {
            gte: new Date(filters.startDate),
            lte: new Date(filters.endDate),
          },
        }),
        ...(filters.search && {
          OR: [
            { title: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } },
            { paymentMethod: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        category: true,
        branch: {
          select: { id: true, name: true },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOneExpense(tenantId: string, id: string, branchIdContext?: string | null) {
    const expense = await this.prisma.expense.findFirst({
      where: {
        id,
        tenantId,
        ...(branchIdContext && { branchId: branchIdContext }),
      },
      include: {
        category: true,
        branch: {
          select: { id: true, name: true },
        },
      },
    });

    if (!expense) {
      throw new NotFoundException(`Expense not found.`);
    }

    return expense;
  }

  async updateExpense(
    tenantId: string,
    id: string,
    branchIdContext: string | null,
    userRole: string,
    dto: CreateExpenseDto,
  ) {
    const { title, description, amount, date, paymentMethod, categoryId, branchId } = dto;

    // Enforce branch context if ADMIN
    let finalBranchId = branchId;
    if (userRole === 'ADMIN') {
      if (!branchIdContext) {
        throw new BadRequestException('Branch context is required for administrators.');
      }
      finalBranchId = branchIdContext;
    }

    // Verify expense exists and belongs to correct tenant/branch context
    const expense = await this.prisma.expense.findFirst({
      where: {
        id,
        tenantId,
        ...(userRole === 'ADMIN' && { branchId: branchIdContext }),
      },
    });

    if (!expense) {
      throw new NotFoundException(`Expense not found.`);
    }

    // Verify category exists
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id: categoryId, tenantId },
    });
    if (!category) {
      throw new NotFoundException(`Expense category not found.`);
    }

    // Verify branch belongs to tenant
    if (finalBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: finalBranchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundException(`Branch not found in this organization.`);
      }
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        title,
        description,
        amount,
        date: new Date(date),
        paymentMethod,
        categoryId,
        branchId: finalBranchId || null,
      },
      include: {
        category: true,
        branch: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async removeExpense(
    tenantId: string,
    id: string,
    branchIdContext: string | null,
    userRole: string,
  ) {
    const expense = await this.prisma.expense.findFirst({
      where: {
        id,
        tenantId,
        ...(userRole === 'ADMIN' && { branchId: branchIdContext }),
      },
    });

    if (!expense) {
      throw new NotFoundException(`Expense not found.`);
    }

    return this.prisma.expense.delete({
      where: { id },
    });
  }
}
