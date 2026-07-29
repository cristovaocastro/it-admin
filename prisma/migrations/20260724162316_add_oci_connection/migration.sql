-- CreateEnum
CREATE TYPE "OciTestStatus" AS ENUM ('NEVER_TESTED', 'SUCCESS', 'FAILURE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'OCI_CONNECTION';
ALTER TYPE "AuditEntityType" ADD VALUE 'OCI_INSTANCE';

-- CreateTable
CREATE TABLE "oci_connections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "privateKeyEncrypted" TEXT NOT NULL,
    "passphraseEncrypted" TEXT,
    "defaultRegion" TEXT NOT NULL,
    "regions" TEXT[],
    "compartments" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTestAt" TIMESTAMP(3),
    "lastTestStatus" "OciTestStatus" NOT NULL DEFAULT 'NEVER_TESTED',
    "lastTestError" TEXT,
    "lastTestLatencyMs" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oci_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oci_connections_name_key" ON "oci_connections"("name");

-- AddForeignKey
ALTER TABLE "oci_connections" ADD CONSTRAINT "oci_connections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
