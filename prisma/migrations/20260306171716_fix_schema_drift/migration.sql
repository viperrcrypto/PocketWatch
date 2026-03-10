-- AlterTable
ALTER TABLE "CreditCardPerk" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CreditCardRewardRate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "FinanceTransaction_userId_isDuplicate_date_idx" ON "FinanceTransaction"("userId", "isDuplicate", "date");

-- CreateIndex
CREATE INDEX "FinanceTransaction_userId_isDuplicate_isExcluded_date_idx" ON "FinanceTransaction"("userId", "isDuplicate", "isExcluded", "date");
