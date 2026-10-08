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
    @Query('onlyActive') onlyActive?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.paymentMethodsService.findAll(
      tenantId,
      onlyActive === 'true' || onlyActive === '1',
    );
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new payment method' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreatePaymentMethodDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.paymentMethodsService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({ summary: 'Update a payment method' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.paymentMethodsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({ summary: 'Delete a payment method' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.paymentMethodsService.remove(tenantId, id);
  }
}
