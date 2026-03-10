-- AlterTable
ALTER TABLE "TransactionSyncState" ADD COLUMN     "highWaterMark" INTEGER,
ADD COLUMN     "syncMode" TEXT NOT NULL DEFAULT 'historical';

-- CreateIndex
CREATE INDEX "TransactionSyncState_userId_syncMode_idx" ON "TransactionSyncState"("userId", "syncMode");
