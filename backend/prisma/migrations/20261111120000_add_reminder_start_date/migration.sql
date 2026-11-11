-- AlterTable
ALTER TABLE "reminders" ADD COLUMN "start_date" TIMESTAMP(3);

-- Populate existing start_date from reminder_date
UPDATE "reminders" SET "start_date" = "reminder_date" WHERE "start_date" IS NULL;

