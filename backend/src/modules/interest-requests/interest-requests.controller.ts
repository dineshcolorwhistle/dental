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
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { InterestRequestsService } from './interest-requests.service';
import { CreateInterestRequestDto, InterestRequestStatus } from './dto';
import { Roles, CurrentUser, Public } from '../../common/decorators';

@ApiTags('Interest Requests')
@Controller()
export class InterestRequestsController {
  constructor(
    private readonly interestRequestsService: InterestRequestsService,
  ) {}

  // ──────────────────────────────────────────────────────────
  // PUBLIC ENDPOINTS (no auth required)
  // ──────────────────────────────────────────────────────────

  @Get('public/work-orders/qr/:token')
  @Public()
  @ApiOperation({
    summary: 'Get public work order details by QR token (no auth required)',
  })
  async getPublicWorkOrder(@Param('token') token: string) {
    const workOrder =
      await this.interestRequestsService.getPublicWorkOrderByQrToken(token);

    if (!workOrder) {
      throw new NotFoundException('Work order not found or invalid QR token.');
    }

    return workOrder;
  }

  @Post('public/interest-requests')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit an interest request from the public tracking page',
  })
  async createPublicInterestRequest(@Body() dto: CreateInterestRequestDto) {
    return this.interestRequestsService.create(dto);
  }

  // ──────────────────────────────────────────────────────────
  // ADMIN ENDPOINTS (authenticated)
  // ──────────────────────────────────────────────────────────

  @Get('interest-requests')
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all interest requests (admin view)' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('role') userRole: string,
    @Query('status') statusFilter?: string,
    @Query('search') searchQuery?: string,
  ) {
    return this.interestRequestsService.findAll(
      tenantId,
      userRole,
      statusFilter,
      searchQuery,
    );
  }

  @Patch('interest-requests/:id/status')
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update the status of an interest request' })
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    const validStatuses: InterestRequestStatus[] = [
      InterestRequestStatus.PENDING,
      InterestRequestStatus.CONTACTED,
      InterestRequestStatus.CONVERTED,
      InterestRequestStatus.DISCARDED,
    ];

    if (!validStatuses.includes(status as InterestRequestStatus)) {
      throw new BadRequestException(
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      );
    }

    return this.interestRequestsService.updateStatus(
      id,
      status as InterestRequestStatus,
    );
  }

  @Delete('interest-requests/:id')
  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an interest request' })
  async remove(@Param('id') id: string) {
    return this.interestRequestsService.remove(id);
  }
}
