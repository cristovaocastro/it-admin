-- CreateEnum
CREATE TYPE "BitdefenderTestStatus" AS ENUM ('NEVER_TESTED', 'SUCCESS', 'FAILURE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'BITDEFENDER_CONNECTION';
ALTER TYPE "AuditEntityType" ADD VALUE 'BITDEFENDER_ENDPOINT';
ALTER TYPE "AuditEntityType" ADD VALUE 'BITDEFENDER_QUARANTINE_ITEM';
ALTER TYPE "AuditEntityType" ADD VALUE 'BITDEFENDER_POLICY';
ALTER TYPE "AuditEntityType" ADD VALUE 'BITDEFENDER_INSTALL_PACKAGE';
ALTER TYPE "AuditEntityType" ADD VALUE 'BITDEFENDER_INCIDENT';

-- CreateTable
CREATE TABLE "bitdefender_connections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "companyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTestAt" TIMESTAMP(3),
    "lastTestStatus" "BitdefenderTestStatus" NOT NULL DEFAULT 'NEVER_TESTED',
    "lastTestError" TEXT,
    "lastTestLatencyMs" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bitdefender_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bitdefender_connections_name_key" ON "bitdefender_connections"("name");

-- AddForeignKey
ALTER TABLE "bitdefender_connections" ADD CONSTRAINT "bitdefender_connections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
