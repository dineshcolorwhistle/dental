-- CreateEnum
CREATE TYPE "WhatsAppTriggerEvent" AS ENUM ('EXTERNAL_VERIFICATION_INITIATED', 'EXTERNAL_VERIFICATION_PENDING', 'EXTERNAL_VERIFICATION_OVERDUE');

-- CreateEnum
CREATE TYPE "WhatsAppTemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_event" "WhatsAppTriggerEvent" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "WhatsAppTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "placeholders" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_tenant_id_trigger_event_key" ON "whatsapp_templates"("tenant_id", "trigger_event");

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
