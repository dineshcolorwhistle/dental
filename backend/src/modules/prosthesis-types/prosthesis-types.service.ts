import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProsthesisTypeDto, UpdateProsthesisTypeDto } from './dto';

@Injectable()
export class ProsthesisTypesService {
  private readonly logger = new Logger(ProsthesisTypesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateProsthesisTypeDto) {
    const { name, description } = dto;

    // Check for duplicate name in the same tenant
    const existing = await this.prisma.prosthesisType.findFirst({
      where: {
        tenantId,
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(`A prosthesis type with the name "${name}" already exists.`);
    }

    const type = await this.prisma.prosthesisType.create({
      data: {
        tenantId,
        name,
        description,
      },
    });

    this.logger.log(`Prosthesis type created: ${type.name} (${type.id}) for tenant ${tenantId}`);
    return type;
  }

  async findAll(tenantId: string) {
    return this.prisma.prosthesisType.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const type = await this.prisma.prosthesisType.findFirst({
      where: { id, tenantId },
    });

    if (!type) {
      throw new NotFoundException(`Prosthesis type with ID "${id}" not found.`);
    }

    return type;
  }

  async update(tenantId: string, id: string, dto: UpdateProsthesisTypeDto) {
    // Verify existence
    await this.findOne(tenantId, id);

    const { name, description } = dto;

    if (name) {
      const existing = await this.prisma.prosthesisType.findFirst({
        where: {
          tenantId,
          name: { equals: name, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(`A prosthesis type with the name "${name}" already exists.`);
      }
    }

    const updated = await this.prisma.prosthesisType.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
    });

    this.logger.log(`Prosthesis type updated: ${updated.name} (${updated.id})`);
    return updated;
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    await this.prisma.prosthesisType.delete({
      where: { id },
    });

    this.logger.log(`Prosthesis type deleted: ${id} inside tenant ${tenantId}`);
    return { success: true };
  }
}
