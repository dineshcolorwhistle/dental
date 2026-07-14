-- AlterTable
ALTER TABLE "processes" ADD COLUMN     "process_area_id" TEXT;

-- CreateTable
CREATE TABLE "process_areas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_areas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "process_areas_tenant_id_branch_id_name_key" ON "process_areas"("tenant_id", "branch_id", "name");

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_process_area_id_fkey" FOREIGN KEY ("process_area_id") REFERENCES "process_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_areas" ADD CONSTRAINT "process_areas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_areas" ADD CONSTRAINT "process_areas_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
