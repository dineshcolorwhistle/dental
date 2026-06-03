import {
  Controller,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles, CurrentUser } from '../../common/decorators';
import { FinanceService } from './finance.service';

@ApiTags('Finance')
@ApiBearerAuth()
@Controller('finance')
@Roles(UserRole.OWNER)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get general financial metrics and reports for Owner' })
  async getFinanceStats(
    @CurrentUser('tenantId') tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('branchIds') branchIds?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required query parameters.');
    }
    return this.financeService.getFinanceStats(tenantId, startDate, endDate, branchIds);
  }

  @Get('pending-payments')
  @ApiOperation({ summary: 'Get a list of work orders with pending payments' })
  async getPendingPayments(
    @CurrentUser('tenantId') tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('branchIds') branchIds?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required query parameters.');
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    return this.financeService.getPendingPayments(
      tenantId,
      startDate,
      endDate,
      branchIds,
      pageNum,
      limitNum,
      search || '',
    );
  }
}
