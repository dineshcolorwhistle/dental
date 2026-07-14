import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('API Keys')
@ApiBearerAuth()
@Controller('api-keys')
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List API keys for the current branch' })
  async findAll(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchId: string | null,
    @CurrentUser('role') userRole: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }

    if (!branchId && userRole === 'ADMIN') {
      throw new BadRequestException('Branch context is required.');
    }

    // For owners without branch context, they can't list keys without a branch
    if (!branchId) {
      throw new BadRequestException(
        'Branch context is required to manage API keys.',
      );
    }

    return this.apiKeysService.findAll(tenantId, branchId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate a new API key for the current branch' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('branchId') branchId: string | null,
    @CurrentUser('role') userRole: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }

    if (!branchId) {
      throw new BadRequestException(
        'Branch context is required to create an API key.',
      );
    }

    return this.apiKeysService.create(tenantId, branchId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an API key' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.apiKeysService.remove(tenantId, id);
  }
}
