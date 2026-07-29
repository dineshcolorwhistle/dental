import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { WhatsAppTemplatesService } from './whatsapp-templates.service';
import { CreateWhatsAppTemplateDto } from './dto/create-whatsapp-template.dto';
import { UpdateWhatsAppTemplateDto } from './dto/update-whatsapp-template.dto';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('WhatsApp Templates')
@ApiBearerAuth()
@Controller('whatsapp-templates')
@Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
export class WhatsAppTemplatesController {
  constructor(
    private readonly whatsappTemplatesService: WhatsAppTemplatesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all WhatsApp templates for the organization' })
  async findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.whatsappTemplatesService.findAll(tenantId || '');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a WhatsApp template by ID' })
  async findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.whatsappTemplatesService.findOne(tenantId || '', id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new WhatsApp template' })
  async create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateWhatsAppTemplateDto,
  ) {
    return this.whatsappTemplatesService.create(tenantId || '', dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing WhatsApp template' })
  async update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWhatsAppTemplateDto,
  ) {
    return this.whatsappTemplatesService.update(tenantId || '', id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a WhatsApp template' })
  async remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.whatsappTemplatesService.remove(tenantId || '', id);
  }
}
