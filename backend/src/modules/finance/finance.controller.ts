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
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get general financial metrics and reports' })
  async getFinanceStats(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('role') userRole: UserRole,
    @CurrentUser('branchId') branchIdContext: string | null,
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

    let finalBranchIds = branchIds;
    if (userRole === UserRole.ADMIN) {
      finalBranchIds = branchIdContext || 'NONE';
    }

    return this.financeService.getFinanceStats(tenantId, startDate, endDate, finalBranchIds);
  }

  @Get('pending-payments')
  @ApiOperation({ summary: 'Get a list of work orders with pending payments' })
  async getPendingPayments(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('role') userRole: UserRole,
    @CurrentUser('branchId') branchIdContext: string | null,
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

    let finalBranchIds = branchIds;
    if (userRole === UserRole.ADMIN) {
      finalBranchIds = branchIdContext || 'NONE';
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    return this.financeService.getPendingPayments(
      tenantId,
      startDate,
      endDate,
      finalBranchIds,
      pageNum,
      limitNum,
      search || '',
    );
  }
}
