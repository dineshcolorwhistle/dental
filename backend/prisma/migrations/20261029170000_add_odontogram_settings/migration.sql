-- CreateEnum
CREATE TYPE "TeethModel" AS ENUM ('ADULT', 'CHILD');

-- CreateTable
CREATE TABLE "odontogram_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "default_teeth_model" "TeethModel" NOT NULL DEFAULT 'ADULT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "odontogram_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odontogram_treatments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL,
    "applies_to_whole_tooth" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "odontogram_treatments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odontogram_diagnostics" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL,
    "applies_to_whole_tooth" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "odontogram_diagnostics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "odontogram_configs_tenant_id_branch_id_key" ON "odontogram_configs"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "odontogram_treatments_tenant_id_branch_id_name_key" ON "odontogram_treatments"("tenant_id", "branch_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "odontogram_diagnostics_tenant_id_branch_id_name_key" ON "odontogram_diagnostics"("tenant_id", "branch_id", "name");

-- AddForeignKey
ALTER TABLE "odontogram_configs" ADD CONSTRAINT "odontogram_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odontogram_configs" ADD CONSTRAINT "odontogram_configs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odontogram_treatments" ADD CONSTRAINT "odontogram_treatments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odontogram_treatments" ADD CONSTRAINT "odontogram_treatments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odontogram_diagnostics" ADD CONSTRAINT "odontogram_diagnostics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odontogram_diagnostics" ADD CONSTRAINT "odontogram_diagnostics_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

