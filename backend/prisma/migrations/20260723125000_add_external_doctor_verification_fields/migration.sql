-- AlterTable
ALTER TABLE "work_order_processes" ADD COLUMN IF NOT EXISTS "external_doctor_status" TEXT,
ADD COLUMN IF NOT EXISTS "external_doctor_notes" TEXT,
ADD COLUMN IF NOT EXISTS "external_doctor_submitted_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "verification_resolved_by_id" TEXT;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_order_processes_verification_resolved_by_id_fkey'
  ) THEN
    ALTER TABLE "work_order_processes" ADD CONSTRAINT "work_order_processes_verification_resolved_by_id_fkey" FOREIGN KEY ("verification_resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
