-- CreateTable
CREATE TABLE "clinic_prosthesis_types" (
    "id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "prosthesis_type_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_prosthesis_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinic_prosthesis_types_clinic_id_prosthesis_type_id_key" ON "clinic_prosthesis_types"("clinic_id", "prosthesis_type_id");

-- AddForeignKey
ALTER TABLE "clinic_prosthesis_types" ADD CONSTRAINT "clinic_prosthesis_types_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_prosthesis_types" ADD CONSTRAINT "clinic_prosthesis_types_prosthesis_type_id_fkey" FOREIGN KEY ("prosthesis_type_id") REFERENCES "prosthesis_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
