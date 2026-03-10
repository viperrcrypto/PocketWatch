-- Revert Float columns back from Text.
-- Only Json columns (breakdown, positions, metadata) stay as Text for encryption.

-- FinanceTransaction: amount back to DOUBLE PRECISION
ALTER TABLE "FinanceTransaction" ALTER COLUMN "amount" TYPE DOUBLE PRECISION USING "amount"::DOUBLE PRECISION;

-- FinanceAccount: balances back to DOUBLE PRECISION
ALTER TABLE "FinanceAccount" ALTER COLUMN "currentBalance" TYPE DOUBLE PRECISION USING "currentBalance"::DOUBLE PRECISION;
ALTER TABLE "FinanceAccount" ALTER COLUMN "availableBalance" TYPE DOUBLE PRECISION USING "availableBalance"::DOUBLE PRECISION;
ALTER TABLE "FinanceAccount" ALTER COLUMN "creditLimit" TYPE DOUBLE PRECISION USING "creditLimit"::DOUBLE PRECISION;

-- FinanceSnapshot: float fields back to DOUBLE PRECISION (breakdown stays Text)
ALTER TABLE "FinanceSnapshot" ALTER COLUMN "totalAssets" TYPE DOUBLE PRECISION USING "totalAssets"::DOUBLE PRECISION;
ALTER TABLE "FinanceSnapshot" ALTER COLUMN "totalDebt" TYPE DOUBLE PRECISION USING "totalDebt"::DOUBLE PRECISION;
ALTER TABLE "FinanceSnapshot" ALTER COLUMN "netWorth" TYPE DOUBLE PRECISION USING "netWorth"::DOUBLE PRECISION;

-- BalanceSnapshot: totalValue back to DOUBLE PRECISION (positions stays Text)
ALTER TABLE "BalanceSnapshot" ALTER COLUMN "totalValue" TYPE DOUBLE PRECISION USING "totalValue"::DOUBLE PRECISION;

-- PortfolioSnapshot: totalValue back to DOUBLE PRECISION (metadata stays Text)
ALTER TABLE "PortfolioSnapshot" ALTER COLUMN "totalValue" TYPE DOUBLE PRECISION USING "totalValue"::DOUBLE PRECISION;

-- TransactionCache: value, usdValue back to DOUBLE PRECISION
ALTER TABLE "TransactionCache" ALTER COLUMN "value" TYPE DOUBLE PRECISION USING "value"::DOUBLE PRECISION;
ALTER TABLE "TransactionCache" ALTER COLUMN "usdValue" TYPE DOUBLE PRECISION USING "usdValue"::DOUBLE PRECISION;
