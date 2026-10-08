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
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Payment Methods')
@ApiBearerAuth()
@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.TECHNICIAN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all payment methods for the current tenant' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('role') role: string,
    @Query('onlyActive') onlyActive?: string,
  ) {
    const resolvedTenantId = await this.paymentMethodsService.resolveTenantId(tenantId, role);
    return this.paymentMethodsService.findAll(
      resolvedTenantId,
      onlyActive === 'true' || onlyActive === '1',
    );
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new payment method' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('role') role: string,
    @Body() dto: CreatePaymentMethodDto,
  ) {
    const resolvedTenantId = await this.paymentMethodsService.resolveTenantId(tenantId, role);
    return this.paymentMethodsService.create(resolvedTenantId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a payment method' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    const resolvedTenantId = await this.paymentMethodsService.resolveTenantId(tenantId, role);
    return this.paymentMethodsService.update(resolvedTenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a payment method' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('role') role: string,
    @Param('id') id: string,
  ) {
    const resolvedTenantId = await this.paymentMethodsService.resolveTenantId(tenantId, role);
    return this.paymentMethodsService.remove(resolvedTenantId, id);
  }
}
