-- AlterTable
ALTER TABLE "work_order_processes" ADD COLUMN     "external_doctor_status" TEXT,
ADD COLUMN     "external_doctor_notes" TEXT,
ADD COLUMN     "external_doctor_submitted_at" TIMESTAMP(3),
ADD COLUMN     "verification_resolved_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "work_order_processes" ADD CONSTRAINT "work_order_processes_verification_resolved_by_id_fkey" FOREIGN KEY ("verification_resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
