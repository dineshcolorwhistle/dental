-- AlterTable: Update column defaults for timezone and currency
ALTER TABLE "tenant_settings" ALTER COLUMN "timezone" SET DEFAULT 'America/Mexico_City';
ALTER TABLE "tenant_settings" ALTER COLUMN "currency" SET DEFAULT 'MXN';

-- Data Migration: Safely update existing tenants who are still on the old defaults
UPDATE "tenant_settings" 
SET "timezone" = 'America/Mexico_City' 
WHERE "timezone" = 'UTC' OR "timezone" IS NULL;

UPDATE "tenant_settings" 
SET "currency" = 'MXN' 
WHERE "currency" = 'INR' OR "currency" IS NULL;
