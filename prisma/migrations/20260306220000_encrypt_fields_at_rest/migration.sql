-- Encrypt fields at rest: Convert Float/Json columns to Text
-- so they can store AES-256-GCM encrypted ciphertext (base64 strings).

-- FinanceTransaction: amount (Float -> Text)
ALTER TABLE "FinanceTransaction" ALTER COLUMN "amount" TYPE TEXT USING "amount"::TEXT;

-- FinanceAccount: currentBalance, availableBalance, creditLimit (Float? -> Text?)
ALTER TABLE "FinanceAccount" ALTER COLUMN "currentBalance" TYPE TEXT USING "currentBalance"::TEXT;
ALTER TABLE "FinanceAccount" ALTER COLUMN "availableBalance" TYPE TEXT USING "availableBalance"::TEXT;
ALTER TABLE "FinanceAccount" ALTER COLUMN "creditLimit" TYPE TEXT USING "creditLimit"::TEXT;

-- FinanceSnapshot: totalAssets, totalDebt, netWorth (Float -> Text), breakdown (Json -> Text)
ALTER TABLE "FinanceSnapshot" ALTER COLUMN "totalAssets" TYPE TEXT USING "totalAssets"::TEXT;
ALTER TABLE "FinanceSnapshot" ALTER COLUMN "totalDebt" TYPE TEXT USING "totalDebt"::TEXT;
ALTER TABLE "FinanceSnapshot" ALTER COLUMN "netWorth" TYPE TEXT USING "netWorth"::TEXT;
ALTER TABLE "FinanceSnapshot" ALTER COLUMN "breakdown" TYPE TEXT USING "breakdown"::TEXT;

-- BalanceSnapshot: totalValue (Float -> Text), positions (Json -> Text)
ALTER TABLE "BalanceSnapshot" ALTER COLUMN "totalValue" TYPE TEXT USING "totalValue"::TEXT;
ALTER TABLE "BalanceSnapshot" ALTER COLUMN "positions" TYPE TEXT USING "positions"::TEXT;

-- PortfolioSnapshot: totalValue (Float -> Text), metadata (Json? -> Text?)
ALTER TABLE "PortfolioSnapshot" ALTER COLUMN "totalValue" TYPE TEXT USING "totalValue"::TEXT;
ALTER TABLE "PortfolioSnapshot" ALTER COLUMN "metadata" TYPE TEXT USING "metadata"::TEXT;

-- TransactionCache: value, usdValue (Float? -> Text?), rawValue already String
ALTER TABLE "TransactionCache" ALTER COLUMN "value" TYPE TEXT USING "value"::TEXT;
ALTER TABLE "TransactionCache" ALTER COLUMN "usdValue" TYPE TEXT USING "usdValue"::TEXT;
