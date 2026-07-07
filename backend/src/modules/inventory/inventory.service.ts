import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInventoryDto, UpdateInventoryDto, CreateCategoryDto } from './dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Categories ──────────────────────────────────────────

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    const { name, description, status, productType } = dto;

    const existing = await this.prisma.inventoryCategory.findUnique({
      where: {
        tenantId_name: {
          tenantId,
          name,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Category "${name}" already exists.`);
    }

    return this.prisma.inventoryCategory.create({
      data: {
        tenantId,
        name,
        description,
        status: status || 'active',
        productType: productType || 'for_use',
      },
    });
  }

  async findAllCategories(tenantId: string) {
    return this.prisma.inventoryCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async updateCategory(tenantId: string, id: string, dto: CreateCategoryDto) {
    const { name, description, status, productType } = dto;

    const category = await this.prisma.inventoryCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      throw new NotFoundException(`Category not found.`);
    }

    const existing = await this.prisma.inventoryCategory.findFirst({
      where: {
        tenantId,
        name,
        id: { not: id },
      },
    });

    if (existing) {
      throw new ConflictException(`Category "${name}" already exists.`);
    }

    return this.prisma.inventoryCategory.update({
      where: { id },
      data: {
        name,
        description,
        status,
        productType,
      },
    });
  }

  async removeCategory(tenantId: string, id: string) {
    const category = await this.prisma.inventoryCategory.findFirst({
      where: { id, tenantId },
    });

    if (!category) {
      throw new NotFoundException(`Category not found.`);
    }

    // Check if category is in use
    const inUse = await this.prisma.inventoryItem.count({
      where: { categoryId: id },
    });

    if (inUse > 0) {
      throw new BadRequestException('Cannot delete category because it is in use by inventory items.');
    }

    return this.prisma.inventoryCategory.delete({
      where: { id },
    });
  }

  // ─── Inventory Items ─────────────────────────────────────

  async createItem(
    tenantId: string,
    branchIdContext: string | null,
    userRole: string,
    dto: CreateInventoryDto,
  ) {
    const {
      name,
      sku,
      categoryId,
      status,
      currentQuantity,
      minQuantity,
      unitPrice,
      brand,
      supplier,
      expiryDate,
      description,
      branchId,
    } = dto;

    // Resolve branch ID
    let finalBranchId = branchId;
    if (userRole === 'ADMIN') {
      if (!branchIdContext) {
        throw new BadRequestException('Branch context is required for administrators.');
      }
      finalBranchId = branchIdContext;
    }

    // Check category exists in tenant
    const category = await this.prisma.inventoryCategory.findFirst({
      where: { id: categoryId, tenantId },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID "${categoryId}" not found.`);
    }

    // Verify branch belongs to tenant
    if (finalBranchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: finalBranchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundException(`Branch with ID "${finalBranchId}" not found in your organization.`);
      }
    }

    // Check SKU uniqueness per tenant & branch
    const existingSku = await this.prisma.inventoryItem.findFirst({
      where: {
        tenantId,
        branchId: finalBranchId || null,
        sku,
      },
    });

    if (existingSku) {
      throw new ConflictException(`An inventory item with SKU "${sku}" already exists in the selected branch.`);
    }

    return this.prisma.inventoryItem.create({
      data: {
        tenantId,
        branchId: finalBranchId || null,
        name,
        sku,
        categoryId,
        status,
        currentQuantity,
        minQuantity,
        unitPrice,
        brand,
        supplier,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        description,
      },
      include: {
        category: true,
        branch: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async findAllItems(
    tenantId: string,
    branchIdContext: string | null,
    userRole: string,
    branchIdFilter?: string,
    categoryIdFilter?: string,
    statusFilter?: string,
  ) {
    // If logged in as ADMIN, restrict queries to their branch
    let finalBranchIdFilter = branchIdFilter;
    if (userRole === 'ADMIN') {
      finalBranchIdFilter = branchIdContext || undefined;
    }

    return this.prisma.inventoryItem.findMany({
      where: {
        tenantId,
        ...(finalBranchIdFilter &&
          finalBranchIdFilter !== 'ALL' && { branchId: finalBranchIdFilter }),
        ...(categoryIdFilter &&
          categoryIdFilter !== 'ALL' && { categoryId: categoryIdFilter }),
        ...(statusFilter &&
          statusFilter !== 'ALL' && { status: statusFilter }),
      },
      include: {
        category: true,
        branch: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneItem(tenantId: string, id: string, branchIdContext?: string | null) {
    const item = await this.prisma.inventoryItem.findFirst({
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

    if (!item) {
      throw new NotFoundException(`Inventory item not found.`);
    }

    return item;
  }

  async updateItem(
    tenantId: string,
    id: string,
    branchIdContext: string | null,
    userRole: string,
    dto: UpdateInventoryDto,
  ) {
    // Ensure item exists & user has access
    const item = await this.findOneItem(tenantId, id, userRole === 'ADMIN' ? branchIdContext : null);

    const {
      name,
      sku,
      categoryId,
      status,
      currentQuantity,
      minQuantity,
      unitPrice,
      brand,
      supplier,
      expiryDate,
      description,
      branchId,
    } = dto;

    let finalBranchId = branchId !== undefined ? branchId : item.branchId;
    if (userRole === 'ADMIN') {
      finalBranchId = branchIdContext; // Admins cannot change the branch of an item to another branch
    }

    // Verify category if changed
    if (categoryId) {
      const category = await this.prisma.inventoryCategory.findFirst({
        where: { id: categoryId, tenantId },
      });
      if (!category) {
        throw new NotFoundException(`Category not found.`);
      }
    }

    // Verify branch if changed
    if (finalBranchId && finalBranchId !== item.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: finalBranchId, tenantId },
      });
      if (!branch) {
        throw new NotFoundException(`Branch not found.`);
      }
    }

    // Verify SKU uniqueness if SKU or Branch changed
    if (sku && (sku !== item.sku || finalBranchId !== item.branchId)) {
      const existingSku = await this.prisma.inventoryItem.findFirst({
        where: {
          id: { not: id },
          tenantId,
          branchId: finalBranchId || null,
          sku,
        },
      });

      if (existingSku) {
        throw new ConflictException(`An inventory item with SKU "${sku}" already exists in the selected branch.`);
      }
    }

    return this.prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(sku && { sku }),
        ...(categoryId && { categoryId }),
        ...(status && { status }),
        ...(currentQuantity !== undefined && { currentQuantity }),
        ...(minQuantity !== undefined && { minQuantity }),
        ...(unitPrice !== undefined && { unitPrice }),
        ...(brand !== undefined && { brand }),
        ...(supplier !== undefined && { supplier }),
        ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
        ...(description !== undefined && { description }),
        ...(userRole !== 'ADMIN' && branchId !== undefined && { branchId: finalBranchId }),
      },
      include: {
        category: true,
        branch: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async removeItem(tenantId: string, id: string, branchIdContext?: string | null) {
    const item = await this.findOneItem(tenantId, id, branchIdContext);
    return this.prisma.inventoryItem.delete({
      where: { id: item.id },
    });
  }
}
