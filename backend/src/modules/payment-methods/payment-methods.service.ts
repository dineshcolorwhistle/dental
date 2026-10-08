import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto } from './dto';

const DEFAULT_PAYMENT_METHODS = [
  { name: 'Cash', description: 'Cash payment / Efectivo' },
  { name: 'Credit Card', description: 'Credit Card / Tarjeta de Crédito' },
  { name: 'Debit Card', description: 'Debit Card / Tarjeta de Débito' },
  { name: 'Bank Transfer', description: 'Electronic bank transfer / Transferencia' },
  { name: 'Check', description: 'Check / Cheque' },
];

@Injectable()
export class PaymentMethodsService {
  private readonly logger = new Logger(PaymentMethodsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seed default payment methods for a tenant if none exist.
   */
  async seedDefaultsIfEmpty(tenantId: string): Promise<void> {
    const count = await this.prisma.paymentMethod.count({
      where: { tenantId },
    });

    if (count === 0) {
      this.logger.log(`Seeding default payment methods for tenant: ${tenantId}`);
      await this.prisma.$transaction(
        DEFAULT_PAYMENT_METHODS.map((m) =>
          this.prisma.paymentMethod.create({
            data: {
              tenantId,
              name: m.name,
              description: m.description,
              isActive: true,
            },
          }),
        ),
      );
    }
  }

  /**
   * List all payment methods for a tenant.
   */
  async findAll(tenantId: string, onlyActive = false) {
    await this.seedDefaultsIfEmpty(tenantId);

    return this.prisma.paymentMethod.findMany({
      where: {
        tenantId,
        ...(onlyActive ? { isActive: true } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find a single payment method by ID.
   */
  async findOne(tenantId: string, id: string) {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id, tenantId },
    });

    if (!method) {
      throw new NotFoundException(`Payment method with ID "${id}" not found.`);
    }

    return method;
  }

  /**
   * Create a new payment method for a tenant.
   */
  async create(tenantId: string, dto: CreatePaymentMethodDto) {
    const trimmedName = dto.name.trim();

    // Check duplicate name within tenant
    const existing = await this.prisma.paymentMethod.findFirst({
      where: {
        tenantId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A payment method named "${trimmedName}" already exists.`,
      );
    }

    return this.prisma.paymentMethod.create({
      data: {
        tenantId,
        name: trimmedName,
        description: dto.description?.trim() || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  /**
   * Update an existing payment method.
   */
  async update(tenantId: string, id: string, dto: UpdatePaymentMethodDto) {
    await this.findOne(tenantId, id);

    if (dto.name) {
      const trimmedName = dto.name.trim();
      const duplicate = await this.prisma.paymentMethod.findFirst({
        where: {
          tenantId,
          name: { equals: trimmedName, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `A payment method named "${trimmedName}" already exists.`,
        );
      }
    }

    return this.prisma.paymentMethod.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim() || null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  /**
   * Delete a payment method.
   */
  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    return this.prisma.paymentMethod.delete({
      where: { id },
    });
  }
}
