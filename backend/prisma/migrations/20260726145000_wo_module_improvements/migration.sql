-- AlterTable
ALTER TABLE "work_orders" ALTER COLUMN "patient" DROP NOT NULL,
ADD COLUMN     "delivery_date" TIMESTAMP(3),
ADD COLUMN     "payment_reference_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[];
