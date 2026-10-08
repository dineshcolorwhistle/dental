import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

  private async resolveTenantId(tenantId?: string, role?: string): Promise<string> {
    if (tenantId && tenantId.trim() !== '') {
      return tenantId;
    }
    // If user is SUPER_ADMIN or tenantId is missing, fallback to the first active tenant
    const firstTenant = await this.prisma.tenant.findFirst({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    if (firstTenant?.id) {
      return firstTenant.id;
    }
    throw new BadRequestException('Organization context is required.');
  }

  async seedDefaults(tenantId: string) {
    try {
      if (!this.templateModel || !tenantId) return;
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

  async findAll(tenantId: string, role?: string) {
    const effectiveTenantId = await this.resolveTenantId(tenantId, role);
    await this.seedDefaults(effectiveTenantId);

    if (!this.templateModel) return [];
    return this.templateModel.findMany({
      where: { tenantId: effectiveTenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string, role?: string) {
    const effectiveTenantId = await this.resolveTenantId(tenantId, role);
    if (!this.templateModel) throw new NotFoundException('Service unavailable');
    const template = await this.templateModel.findFirst({
      where: { id, tenantId: effectiveTenantId },
    });

    if (!template) {
      throw new NotFoundException(
        `WhatsApp template with ID "${id}" not found.`,
      );
    }

    return template;
  }

  async create(tenantId: string, dto: CreateWhatsAppTemplateDto, role?: string) {
    const effectiveTenantId = await this.resolveTenantId(tenantId, role);
    if (!this.templateModel) throw new NotFoundException('Service unavailable');

    try {
      return await this.templateModel.create({
        data: {
          tenantId: effectiveTenantId,
          name: dto.name,
          triggerEvent: dto.triggerEvent ? dto.triggerEvent : null,
          message: dto.message,
          status: dto.status ?? WhatsAppTemplateStatus.ACTIVE,
          placeholders: dto.placeholders ?? DEFAULT_PLACEHOLDERS,
        },
      });
    } catch (error: any) {
      console.error('[WhatsAppTemplatesService] Create error:', error);
      throw error;
    }
  }

  async update(tenantId: string, id: string, dto: UpdateWhatsAppTemplateDto, role?: string) {
    const effectiveTenantId = await this.resolveTenantId(tenantId, role);
    await this.findOne(effectiveTenantId, id, role);

    try {
      return await this.templateModel.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.triggerEvent !== undefined && {
            triggerEvent: dto.triggerEvent ? dto.triggerEvent : null,
          }),
          ...(dto.message && { message: dto.message }),
          ...(dto.status && { status: dto.status }),
          ...(dto.placeholders && { placeholders: dto.placeholders }),
        },
      });
    } catch (error: any) {
      console.error('[WhatsAppTemplatesService] Update error:', error);
      throw error;
    }
  }

  async remove(tenantId: string, id: string, role?: string) {
    const effectiveTenantId = await this.resolveTenantId(tenantId, role);
    await this.findOne(effectiveTenantId, id, role);

    try {
      return await this.templateModel.delete({
        where: { id },
      });
    } catch (error: any) {
      console.error('[WhatsAppTemplatesService] Delete error:', error);
      throw error;
    }
  }
}
