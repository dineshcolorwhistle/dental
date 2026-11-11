-- Sync existing inventory item statuses based on quantity thresholds
UPDATE "inventory_items"
SET "status" = 'OUT_OF_STOCK'
WHERE "status" != 'DISCONTINUED' AND "current_quantity" <= 0;

UPDATE "inventory_items"
SET "status" = 'LOW_STOCK'
WHERE "status" != 'DISCONTINUED' AND "current_quantity" > 0 AND "current_quantity" <= "min_quantity";

UPDATE "inventory_items"
SET "status" = 'IN_STOCK'
WHERE "status" != 'DISCONTINUED' AND "current_quantity" > "min_quantity";

