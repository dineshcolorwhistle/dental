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
    try {
      await this.$executeRawUnsafe(
        'ALTER TABLE "prosthesis_types" ADD COLUMN IF NOT EXISTS "price" DOUBLE PRECISION DEFAULT 0;',
      );
      await this.$executeRawUnsafe(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WhatsAppTemplateStatus') THEN
            CREATE TYPE "WhatsAppTemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE');
          END IF;
        END $$;
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "whatsapp_templates" (
          "id" TEXT NOT NULL,
          "tenant_id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "trigger_event" TEXT,
          "message" TEXT NOT NULL,
          "status" "WhatsAppTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
          "placeholders" JSONB NOT NULL DEFAULT '[]',
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "whatsapp_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "clinic_prosthesis_types" (
          "id" TEXT NOT NULL,
          "clinic_id" TEXT NOT NULL,
          "prosthesis_type_id" TEXT NOT NULL,
          "price" DOUBLE PRECISION,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "clinic_prosthesis_types_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "clinic_prosthesis_types_clinic_id_prosthesis_type_id_key" UNIQUE ("clinic_id", "prosthesis_type_id"),
          CONSTRAINT "clinic_prosthesis_types_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "clinic_prosthesis_types_prosthesis_type_id_fkey" FOREIGN KEY ("prosthesis_type_id") REFERENCES "prosthesis_types"("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
      await this.$executeRawUnsafe(`
        ALTER TABLE "clinic_prosthesis_types" ADD COLUMN IF NOT EXISTS "price" DOUBLE PRECISION;
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "doctor_lists" (
          "id" TEXT NOT NULL,
          "tenant_id" TEXT NOT NULL,
          "branch_id" TEXT,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "doctor_lists_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "doctor_lists_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "doctor_lists_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE
        );
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "doctor_list_members" (
          "id" TEXT NOT NULL,
          "list_id" TEXT NOT NULL,
          "doctor_id" TEXT NOT NULL,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "doctor_list_members_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "doctor_list_members_list_id_doctor_id_key" UNIQUE ("list_id", "doctor_id"),
          CONSTRAINT "doctor_list_members_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "doctor_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "doctor_list_members_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
      await this.$executeRawUnsafe(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReminderPriority') THEN
            CREATE TYPE "ReminderPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReminderRecurrence') THEN
            CREATE TYPE "ReminderRecurrence" AS ENUM ('ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReminderStatus') THEN
            CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');
          END IF;
        END $$;
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "reminders" (
          "id" TEXT NOT NULL,
          "tenant_id" TEXT NOT NULL,
          "branch_id" TEXT,
          "title" TEXT NOT NULL,
          "description" TEXT,
          "category" TEXT,
          "priority" "ReminderPriority" NOT NULL DEFAULT 'MEDIUM',
          "reminder_date" TIMESTAMP(3),
          "reminder_time" TEXT NOT NULL,
          "recurrence" "ReminderRecurrence" NOT NULL DEFAULT 'ONE_TIME',
          "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
          "created_by_id" TEXT NOT NULL,
          "last_notified_at" TIMESTAMP(3),
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "reminders_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "reminders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "reminders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
          CONSTRAINT "reminders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "reminder_assignees" (
          "id" TEXT NOT NULL,
          "reminder_id" TEXT NOT NULL,
          "user_id" TEXT NOT NULL,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "reminder_assignees_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "reminder_assignees_reminder_id_user_id_key" UNIQUE ("reminder_id", "user_id"),
          CONSTRAINT "reminder_assignees_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "reminder_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);
    } catch (e) {
      console.error('[SchemaSync] Error ensuring schema updates exist:', e);
    }
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

      console.log(
        `[DataMigration] Found ${unmigratedProcesses.length} unmigrated process records. Starting migration...`,
      );

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
          console.log(
            `[DataMigration] Created ProcessArea "${areaName}" for Tenant ${tenantId}`,
          );
        }

        await this.process.update({
          where: { id: process.id },
          data: {
            processAreaId: processArea.id,
          },
        });
      }

      console.log(
        '[DataMigration] Successfully completed process areas data migration.',
      );
    } catch (error) {
      console.error(
        '[DataMigration] Error running automatic data migration during bootstrap:',
        error,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
