-- AlterEnum
ALTER TYPE "ReminderRecurrence" ADD VALUE 'YEARLY';

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN "repeat_interval" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "end_type" TEXT NOT NULL DEFAULT 'NEVER',
ADD COLUMN "end_date" TIMESTAMP(3),
ADD COLUMN "end_after_occurrences" INTEGER,
ADD COLUMN "completed_occurrences" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "weekly_days" TEXT,
ADD COLUMN "monthly_pattern" TEXT,
ADD COLUMN "monthly_day_of_month" INTEGER,
ADD COLUMN "monthly_week_position" TEXT,
ADD COLUMN "monthly_week_day" INTEGER;
