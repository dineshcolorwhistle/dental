import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomBytes } from 'crypto';
import { CreateApiKeyDto } from './dto';

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a cryptographically secure API key string.
   */
  private generateKey(): string {
    return `dlk_${randomBytes(32).toString('hex')}`;
  }

  /**
   * List all API keys for a given tenant + branch.
   */
  async findAll(tenantId: string, branchId: string) {
    return this.prisma.apiKey.findMany({
      where: { tenantId, branchId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        key: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  /**
   * Create a new API key for a branch.
   * Enforces the one-active-key-per-branch limit by deactivating any existing active key.
   */
  async create(tenantId: string, branchId: string, dto: CreateApiKeyDto) {
    // Deactivate any existing active key for this branch
    await this.prisma.apiKey.updateMany({
      where: { tenantId, branchId, isActive: true },
      data: { isActive: false },
    });

    const key = this.generateKey();

    const apiKey = await this.prisma.apiKey.create({
      data: {
        tenantId,
        branchId,
        name: dto.name,
        key,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        key: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        branch: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    this.logger.log(
      `API key created: "${apiKey.name}" (${apiKey.id}) for branch ${branchId} in tenant ${tenantId}`,
    );

    return apiKey;
  }

  /**
   * Delete (hard-delete) an API key.
   */
  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`API key with ID "${id}" not found.`);
    }

    await this.prisma.apiKey.delete({ where: { id } });

    this.logger.log(
      `API key deleted: "${existing.name}" (${id}) in tenant ${tenantId}`,
    );

    return { success: true };
  }
}
