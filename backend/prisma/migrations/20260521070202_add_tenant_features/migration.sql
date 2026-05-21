-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "features" JSONB NOT NULL DEFAULT '{}';
