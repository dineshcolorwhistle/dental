-- AlterTable: Add default_technician_id to branches
ALTER TABLE "branches" ADD COLUMN "default_technician_id" TEXT;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_default_technician_id_fkey" FOREIGN KEY ("default_technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: Set default technician for existing branches to their earliest active technician
UPDATE "branches" b
SET "default_technician_id" = (
    SELECT u.id
    FROM "users" u
    WHERE u.branch_id = b.id
      AND u.role = 'TECHNICIAN'
      AND u.status = 'ACTIVE'
    ORDER BY u.created_at ASC
    LIMIT 1
)
WHERE b."default_technician_id" IS NULL;

