import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWhatsAppTemplateDto,
  WhatsAppTemplateStatus,
} from './dto/create-whatsapp-template.dto';
import { UpdateWhatsAppTemplateDto } from './dto/update-whatsapp-template.dto';

const DEFAULT_PLACEHOLDERS = [
  'doctor_name',
  'workorder_number',
  'folio_number',
  'boxnumber',
  'verification_link',
];

const DEFAULT_TEMPLATES = [
  {
    name: 'External Verification Initiated',
    triggerEvent: 'EXTERNAL_VERIFICATION_INITIATED',
    message:
      'Hello Dr. {doctor_name}, external verification has been initiated for Work Order #{workorder_number} (Folio: {folio_number}, Box: {boxnumber}). Physical case will reach your clinic soon.',
    status: WhatsAppTemplateStatus.ACTIVE,
    placeholders: DEFAULT_PLACEHOLDERS,
  },
  {
    name: 'External Verification Pending',
    triggerEvent: 'EXTERNAL_VERIFICATION_PENDING',
    message:
      'Hello Dr. {doctor_name}, reminder regarding Work Order #{workorder_number} (Folio: {folio_number}). External verification is pending your review: {verification_link}',
    status: WhatsAppTemplateStatus.ACTIVE,
    placeholders: DEFAULT_PLACEHOLDERS,
  },
  {
    name: 'External Verification Overdue',
    triggerEvent: 'EXTERNAL_VERIFICATION_OVERDUE',
    message:
      'Hello Dr. {doctor_name}, urgent reminder: Verification for Work Order #{workorder_number} (Folio: {folio_number}) is taking longer than expected. Please complete verification faster: {verification_link}',
    status: WhatsAppTemplateStatus.ACTIVE,
    placeholders: DEFAULT_PLACEHOLDERS,
  },
];

@Injectable()
export class WhatsAppTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private get templateModel(): any {
    return (this.prisma as any).whatsAppTemplate;
  }

  async seedDefaults(tenantId: string) {
    try {
      if (!this.templateModel) return;
      const count = await this.templateModel.count({
        where: { tenantId },
      });

      if (count === 0) {
        for (const tpl of DEFAULT_TEMPLATES) {
          await this.templateModel.create({
            data: {
              tenantId,
              name: tpl.name,
              triggerEvent: tpl.triggerEvent,
              message: tpl.message,
              status: tpl.status,
              placeholders: tpl.placeholders,
            },
          });
        }
      }
    } catch (err) {
      console.error('[WhatsAppTemplatesService] Seed defaults error:', err);
    }
  }

  async findAll(tenantId: string) {
    await this.seedDefaults(tenantId);

    if (!this.templateModel) return [];
    return this.templateModel.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    if (!this.templateModel) throw new NotFoundException('Service unavailable');
    const template = await this.templateModel.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      throw new NotFoundException(
        `WhatsApp template with ID "${id}" not found.`,
      );
    }

    return template;
  }

  async create(tenantId: string, dto: CreateWhatsAppTemplateDto) {
    if (!this.templateModel) throw new NotFoundException('Service unavailable');
    return this.templateModel.create({
      data: {
        tenantId,
        name: dto.name,
        triggerEvent: dto.triggerEvent ?? null,
        message: dto.message,
        status: dto.status ?? WhatsAppTemplateStatus.ACTIVE,
        placeholders: dto.placeholders ?? DEFAULT_PLACEHOLDERS,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateWhatsAppTemplateDto) {
    await this.findOne(tenantId, id);

    return this.templateModel.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.triggerEvent !== undefined && {
          triggerEvent: dto.triggerEvent,
        }),
        ...(dto.message && { message: dto.message }),
        ...(dto.status && { status: dto.status }),
        ...(dto.placeholders && { placeholders: dto.placeholders }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    return this.templateModel.delete({
      where: { id },
    });
  }
}
