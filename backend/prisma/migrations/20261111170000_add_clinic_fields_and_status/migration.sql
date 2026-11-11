-- AlterTable
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "is_connected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "connected_at" TIMESTAMP(3);

-- Backfill existing clinics: all existing clinics were created via integration
UPDATE "clinics" SET "is_connected" = true, "connected_at" = "created_at" WHERE "is_connected" = false;

