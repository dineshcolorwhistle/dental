import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an audit log entry.
   */
  async log(data: {
    tenantId: string;
    userId?: string | null;
    userEmail?: string | null;
    action: string;
    entityName: string;
    entityId: string;
    details: any;
  }) {
    try {
      const detailsStr = typeof data.details === 'string' 
        ? data.details 
        : JSON.stringify(data.details);

      const logEntry = await this.prisma.auditLog.create({
        data: {
          tenantId: data.tenantId,
          userId: data.userId || null,
          userEmail: data.userEmail || null,
          action: data.action,
          entityName: data.entityName,
          entityId: data.entityId,
          details: detailsStr,
        },
      });

      this.logger.log(`Audit log written: [${data.action}] for ${data.entityName} (${data.entityId})`);
      return logEntry;
    } catch (error) {
      this.logger.error(`Failed to write audit log: ${error.message}`, error.stack);
    }
  }
}
