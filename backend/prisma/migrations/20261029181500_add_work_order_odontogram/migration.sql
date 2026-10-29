-- CreateTable
CREATE TABLE "work_order_odontograms" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "teeth_model" "TeethModel" NOT NULL DEFAULT 'ADULT',
    "teeth_data" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_odontograms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_order_odontograms_work_order_id_key" ON "work_order_odontograms"("work_order_id");

-- CreateIndex
CREATE INDEX "work_order_odontograms_tenant_id_idx" ON "work_order_odontograms"("tenant_id");

-- AddForeignKey
ALTER TABLE "work_order_odontograms" ADD CONSTRAINT "work_order_odontograms_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_odontograms" ADD CONSTRAINT "work_order_odontograms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

