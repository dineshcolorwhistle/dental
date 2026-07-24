-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InterestRequestStatus" AS ENUM ('PENDING', 'CONTACTED', 'CONVERTED', 'DISCARDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "total_quote" DOUBLE PRECISION;
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "initial_payment" DOUBLE PRECISION;
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "payment_reference_number" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "interest_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "work_order_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "status" "InterestRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interest_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "interest_requests" DROP CONSTRAINT IF EXISTS "interest_requests_tenant_id_fkey";
ALTER TABLE "interest_requests" ADD CONSTRAINT "interest_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interest_requests" DROP CONSTRAINT IF EXISTS "interest_requests_work_order_id_fkey";
ALTER TABLE "interest_requests" ADD CONSTRAINT "interest_requests_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
