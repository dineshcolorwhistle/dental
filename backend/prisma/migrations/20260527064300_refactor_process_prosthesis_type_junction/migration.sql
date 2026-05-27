-- AlterTable: Add branchId to prosthesis_types
ALTER TABLE "prosthesis_types" ADD COLUMN     "branch_id" TEXT;

-- CreateTable: Junction table for many-to-many
CREATE TABLE "prosthesis_type_processes" (
    "id" TEXT NOT NULL,
    "prosthesis_type_id" TEXT NOT NULL,
    "process_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prosthesis_type_processes_pkey" PRIMARY KEY ("id")
);

-- DATA MIGRATION: Copy existing process→prosthesisType links into junction table
INSERT INTO "prosthesis_type_processes" ("id", "prosthesis_type_id", "process_id", "sequence")
SELECT gen_random_uuid(), "prosthesis_type_id", "id", "sequence"
FROM "processes"
WHERE "prosthesis_type_id" IS NOT NULL;

-- DATA MIGRATION: Copy branch_id from processes to their linked prosthesis_types
UPDATE "prosthesis_types" pt
SET "branch_id" = sub."branch_id"
FROM (
    SELECT DISTINCT ON (p."prosthesis_type_id") p."prosthesis_type_id", p."branch_id"
    FROM "processes" p
    WHERE p."prosthesis_type_id" IS NOT NULL AND p."branch_id" IS NOT NULL
    ORDER BY p."prosthesis_type_id", p."created_at" ASC
) sub
WHERE pt."id" = sub."prosthesis_type_id" AND pt."branch_id" IS NULL;

-- DropForeignKey
ALTER TABLE "processes" DROP CONSTRAINT "processes_prosthesis_type_id_fkey";

-- DropIndex
DROP INDEX "prosthesis_types_tenant_id_name_key";

-- AlterTable: Remove old columns from processes
ALTER TABLE "processes" DROP COLUMN "prosthesis_type_id",
DROP COLUMN "sequence";

-- CreateIndex
CREATE UNIQUE INDEX "prosthesis_type_processes_prosthesis_type_id_process_id_key" ON "prosthesis_type_processes"("prosthesis_type_id", "process_id");

-- CreateIndex
CREATE UNIQUE INDEX "prosthesis_types_tenant_id_branch_id_name_key" ON "prosthesis_types"("tenant_id", "branch_id", "name");

-- AddForeignKey
ALTER TABLE "prosthesis_types" ADD CONSTRAINT "prosthesis_types_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prosthesis_type_processes" ADD CONSTRAINT "prosthesis_type_processes_prosthesis_type_id_fkey" FOREIGN KEY ("prosthesis_type_id") REFERENCES "prosthesis_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prosthesis_type_processes" ADD CONSTRAINT "prosthesis_type_processes_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
