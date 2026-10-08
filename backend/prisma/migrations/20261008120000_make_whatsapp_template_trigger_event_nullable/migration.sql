-- DropIndex
DROP INDEX IF EXISTS "whatsapp_templates_tenant_id_trigger_event_key";

-- AlterTable
ALTER TABLE "whatsapp_templates" ALTER COLUMN "trigger_event" DROP NOT NULL;
ALTER TABLE "whatsapp_templates" ALTER COLUMN "trigger_event" TYPE TEXT USING "trigger_event"::TEXT;
