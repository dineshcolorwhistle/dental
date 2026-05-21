import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
@Roles(UserRole.OWNER)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new branch in the owner\'s organization' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateBranchDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.branchesService.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all branches in the owner\'s organization' })
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.branchesService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific branch' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.branchesService.findOne(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a specific branch\'s details' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.branchesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a branch from the organization' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.branchesService.remove(tenantId, id);
  }
}
