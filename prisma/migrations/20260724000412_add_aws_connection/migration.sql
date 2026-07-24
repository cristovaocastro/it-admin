-- CreateEnum
CREATE TYPE "AwsTestStatus" AS ENUM ('NEVER_TESTED', 'SUCCESS', 'FAILURE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'AWS_CONNECTION';
ALTER TYPE "AuditEntityType" ADD VALUE 'AWS_EC2_INSTANCE';

-- CreateTable
CREATE TABLE "aws_connections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessKeyId" TEXT NOT NULL,
    "secretAccessKeyEncrypted" TEXT NOT NULL,
    "defaultRegion" TEXT NOT NULL DEFAULT 'us-east-1',
    "regions" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTestAt" TIMESTAMP(3),
    "lastTestStatus" "AwsTestStatus" NOT NULL DEFAULT 'NEVER_TESTED',
    "lastTestError" TEXT,
    "lastTestLatencyMs" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aws_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aws_connections_name_key" ON "aws_connections"("name");

-- AddForeignKey
ALTER TABLE "aws_connections" ADD CONSTRAINT "aws_connections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
