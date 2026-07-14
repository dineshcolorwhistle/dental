import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }
  async onModuleInit() {
    await this.$connect();
    await this.runDataMigration();
  }

  private async runDataMigration() {
    try {
      const unmigratedProcesses = await this.process.findMany({
        where: {
          processAreaId: null,
          processArea: {
            not: '',
          },
        },
      });

      if (unmigratedProcesses.length === 0) {
        return;
      }

      console.log(`[DataMigration] Found ${unmigratedProcesses.length} unmigrated process records. Starting migration...`);

      for (const process of unmigratedProcesses) {
        const { tenantId, branchId, processArea: areaName } = process;
        if (!areaName) continue;

        let processArea = await this.processArea.findFirst({
          where: {
            tenantId,
            branchId: branchId || null,
            name: areaName,
          },
        });

        if (!processArea) {
          processArea = await this.processArea.create({
            data: {
              tenantId,
              branchId: branchId || null,
              name: areaName,
              description: `Automatically created during migration from process "${process.name}"`,
            },
          });
          console.log(`[DataMigration] Created ProcessArea "${areaName}" for Tenant ${tenantId}`);
        }

        await this.process.update({
          where: { id: process.id },
          data: {
            processAreaId: processArea.id,
          },
        });
      }

      console.log('[DataMigration] Successfully completed process areas data migration.');
    } catch (error) {
      console.error('[DataMigration] Error running automatic data migration during bootstrap:', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
