-- DropIndex
DROP INDEX "ExternalApiKey_userId_serviceName_key";

-- AlterTable
ALTER TABLE "ExternalApiKey" ADD COLUMN     "consecutive429" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "lastErrorAt" TIMESTAMP(3),
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ExternalApiKey_userId_serviceName_idx" ON "ExternalApiKey"("userId", "serviceName");
