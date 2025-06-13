-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ENGLISH', 'RUSSIAN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "language" "Language" NOT NULL DEFAULT 'ENGLISH';
