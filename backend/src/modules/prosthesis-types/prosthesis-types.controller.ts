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
import { ProsthesisTypesService } from './prosthesis-types.service';
import { CreateProsthesisTypeDto, UpdateProsthesisTypeDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('Prosthesis Types')
@ApiBearerAuth()
@Controller('prosthesis-types')
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class ProsthesisTypesController {
  constructor(private readonly prosthesisTypesService: ProsthesisTypesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new prosthesis/work type' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateProsthesisTypeDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.prosthesisTypesService.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all prosthesis/work types' })
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.prosthesisTypesService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific prosthesis type' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.prosthesisTypesService.findOne(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a prosthesis type' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProsthesisTypeDto,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.prosthesisTypesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a prosthesis type' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Organization context is required.');
    }
    return this.prosthesisTypesService.remove(tenantId, id);
  }
}
