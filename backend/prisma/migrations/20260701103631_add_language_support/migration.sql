-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'ES');

-- AlterTable
ALTER TABLE "tenant_settings" ADD COLUMN     "default_language" "Language" NOT NULL DEFAULT 'ES';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "preferred_language" "Language" NOT NULL DEFAULT 'ES';
