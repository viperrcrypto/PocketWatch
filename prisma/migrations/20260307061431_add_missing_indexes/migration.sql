-- CreateIndex
CREATE INDEX "FinanceTransaction_userId_name_idx" ON "FinanceTransaction"("userId", "name");

-- CreateIndex
CREATE INDEX "TransactionCache_userId_blockTimestamp_idx" ON "TransactionCache"("userId", "blockTimestamp");

-- CreateIndex
CREATE INDEX "TransactionSyncState_userId_chain_idx" ON "TransactionSyncState"("userId", "chain");
