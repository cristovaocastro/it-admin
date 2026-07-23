-- CreateEnum
CREATE TYPE "FirewallTestStatus" AS ENUM ('NEVER_TESTED', 'SUCCESS', 'FAILURE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'FIREWALL_CONNECTION';
ALTER TYPE "AuditEntityType" ADD VALUE 'FIREWALL_RULE';
ALTER TYPE "AuditEntityType" ADD VALUE 'FIREWALL_URI_LIST';

-- CreateTable
CREATE TABLE "firewall_connections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 443,
    "adminUsername" TEXT NOT NULL,
    "adminPasswordEncrypted" TEXT NOT NULL,
    "rejectUnauthorized" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTestAt" TIMESTAMP(3),
    "lastTestStatus" "FirewallTestStatus" NOT NULL DEFAULT 'NEVER_TESTED',
    "lastTestError" TEXT,
    "lastTestLatencyMs" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firewall_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "firewall_connections_name_key" ON "firewall_connections"("name");

-- AddForeignKey
ALTER TABLE "firewall_connections" ADD CONSTRAINT "firewall_connections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
