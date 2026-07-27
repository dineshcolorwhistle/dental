-- AlterTable
ALTER TABLE "work_orders" ALTER COLUMN "patient" DROP NOT NULL,
ADD COLUMN IF NOT EXISTS "delivery_date" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "payment_reference_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[];
