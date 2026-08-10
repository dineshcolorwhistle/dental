-- CreateTable
CREATE TABLE "doctor_lists" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_list_members" (
    "id" TEXT NOT NULL,
    "list_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_list_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_list_members_list_id_doctor_id_key" ON "doctor_list_members"("list_id", "doctor_id");

-- AddForeignKey
ALTER TABLE "doctor_lists" ADD CONSTRAINT "doctor_lists_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_lists" ADD CONSTRAINT "doctor_lists_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_list_members" ADD CONSTRAINT "doctor_list_members_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "doctor_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_list_members" ADD CONSTRAINT "doctor_list_members_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
