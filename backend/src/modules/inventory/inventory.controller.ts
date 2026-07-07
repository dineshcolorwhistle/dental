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
import { InventoryService } from './inventory.service';
import { CreateInventoryDto, UpdateInventoryDto, CreateCategoryDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ─── Categories ──────────────────────────────────────────

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new inventory category' })
  async createCategory(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.inventoryService.createCategory(tenantId, dto);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List all inventory categories' })
  async findAllCategories(@CurrentUser('tenantId') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.inventoryService.findAllCategories(tenantId);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update an inventory category' })
  async updateCategory(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateCategoryDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.inventoryService.updateCategory(tenantId, id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an inventory category' })
  async removeCategory(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.inventoryService.removeCategory(tenantId, id);
  }

  // ─── Inventory Items ─────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new inventory item' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Body() dto: CreateInventoryDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.inventoryService.createItem(tenantId, branchIdContext, userRole, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all inventory items' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Query('branchId') branchIdFilter?: string,
    @Query('categoryId') categoryIdFilter?: string,
    @Query('status') statusFilter?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.inventoryService.findAllItems(
      tenantId,
      branchIdContext,
      userRole,
      branchIdFilter,
      categoryIdFilter,
      statusFilter,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific inventory item' })
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
    return this.inventoryService.findOneItem(tenantId, id, branchContext);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Update an inventory item's details" })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchIdContext: string | null,
    @CurrentUser('role') userRole: string,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.inventoryService.updateItem(tenantId, id, branchIdContext, userRole, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an inventory item' })
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
    return this.inventoryService.removeItem(tenantId, id, branchContext);
  }
}
