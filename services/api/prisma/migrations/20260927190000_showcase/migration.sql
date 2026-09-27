-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'BROKER';

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firm" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT NOT NULL,
    "mobile" TEXT,
    "message" TEXT,
    "ip" TEXT,
    "emailedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);
