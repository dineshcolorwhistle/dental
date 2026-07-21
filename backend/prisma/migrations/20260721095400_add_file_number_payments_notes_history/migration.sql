-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "file_number" TEXT,
ADD COLUMN     "payment_reference_number" TEXT;

-- CreateTable
CREATE TABLE "work_order_notes" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_notes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "work_order_notes" ADD CONSTRAINT "work_order_notes_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_notes" ADD CONSTRAINT "work_order_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
