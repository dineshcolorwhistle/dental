-- AlterTable
ALTER TABLE "inventory_categories" ADD COLUMN     "description" TEXT,
ADD COLUMN     "product_type" TEXT NOT NULL DEFAULT 'for_use',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';
