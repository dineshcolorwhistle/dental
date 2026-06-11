-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProcessActivityAction" AS ENUM ('START', 'PAUSE', 'RESUME', 'END');

-- AlterEnum
BEGIN;
CREATE TYPE "WorkOrderStatus_new" AS ENUM ('CREATED', 'ASSIGNED', 'IN_PROGRESS', 'INTERNAL_VERIFICATION', 'EXTERNAL_VERIFICATION', 'COMPLETED', 'FAILED', 'CANCELLED');
ALTER TABLE "public"."work_orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "work_orders" ALTER COLUMN "status" TYPE "WorkOrderStatus_new" USING ("status"::text::"WorkOrderStatus_new");
ALTER TYPE "WorkOrderStatus" RENAME TO "WorkOrderStatus_old";
ALTER TYPE "WorkOrderStatus_new" RENAME TO "WorkOrderStatus";
DROP TYPE "public"."WorkOrderStatus_old";
ALTER TABLE "work_orders" ALTER COLUMN "status" SET DEFAULT 'CREATED';
COMMIT;

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "default_admin_id" TEXT;

-- AlterTable
ALTER TABLE "work_order_processes" ADD COLUMN     "ended_at" TIMESTAMP(3),
ADD COLUMN     "last_paused_at" TIMESTAMP(3),
ADD COLUMN     "pause_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rework_active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rework_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "started_at" TIMESTAMP(3),
ADD COLUMN     "status" "ProcessStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "total_active_duration" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_pause_duration" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verification_status" TEXT;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "color" TEXT NOT NULL DEFAULT 'A1',
ADD COLUMN     "qr_token" TEXT NOT NULL,
ADD COLUMN     "repetition_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "process_activity_logs" (
    "id" TEXT NOT NULL,
    "work_order_process_id" TEXT NOT NULL,
    "action" "ProcessActivityAction" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "process_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_email" TEXT,
    "action" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rework_logs" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "process_name" TEXT NOT NULL,
    "rework_count" INTEGER NOT NULL,
    "initiated_by_id" TEXT NOT NULL,
    "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verification_stage" TEXT NOT NULL,
    "technician_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rework_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repetition_logs" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "repetition_count" INTEGER NOT NULL,
    "initiated_by_id" TEXT NOT NULL,
    "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verification_stage" TEXT NOT NULL,
    "completed_steps" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repetition_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_qr_token_key" ON "work_orders"("qr_token");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_default_admin_id_fkey" FOREIGN KEY ("default_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_activity_logs" ADD CONSTRAINT "process_activity_logs_work_order_process_id_fkey" FOREIGN KEY ("work_order_process_id") REFERENCES "work_order_processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rework_logs" ADD CONSTRAINT "rework_logs_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rework_logs" ADD CONSTRAINT "rework_logs_initiated_by_id_fkey" FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rework_logs" ADD CONSTRAINT "rework_logs_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repetition_logs" ADD CONSTRAINT "repetition_logs_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repetition_logs" ADD CONSTRAINT "repetition_logs_initiated_by_id_fkey" FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
