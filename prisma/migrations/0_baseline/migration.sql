-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."AddressLabel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blockchain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddressLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BalanceSnapshot" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "positions" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CapitalFlow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "flowType" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "usdValue" DOUBLE PRECISION NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapitalFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChartCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ChartCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CostBasisLot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "remainingQty" DOUBLE PRECISION NOT NULL,
    "costBasisUsd" DOUBLE PRECISION NOT NULL,
    "txHash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostBasisLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CreditCardPerk" (
    "id" TEXT NOT NULL,
    "cardProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditCardPerk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CreditCardProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "cardNetwork" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "annualFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rewardType" TEXT NOT NULL,
    "rewardProgram" TEXT,
    "pointsBalance" DOUBLE PRECISION,
    "pointValue" DOUBLE PRECISION,
    "cashbackBalance" DOUBLE PRECISION,
    "totalEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRedeemed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baseRewardRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "bonusCategories" JSONB NOT NULL,
    "statementCredits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditCardProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CreditCardRewardRate" (
    "id" TEXT NOT NULL,
    "cardProfileId" TEXT NOT NULL,
    "spendingCategory" TEXT NOT NULL,
    "rewardRate" DOUBLE PRECISION NOT NULL,
    "rewardType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditCardRewardRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExchangeSyncState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "supportsDeposits" BOOLEAN NOT NULL DEFAULT false,
    "supportsWithdrawals" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExchangeTransactionCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "exchangeLabel" TEXT NOT NULL,
    "txid" TEXT,
    "externalId" TEXT,
    "timestamp" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "address" TEXT,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "network" TEXT,
    "source" TEXT NOT NULL DEFAULT 'exchange',
    "usdValue" DOUBLE PRECISION,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeTransactionCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExternalApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifyError" TEXT,

    CONSTRAINT "ExternalApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "linkedExternalId" TEXT,
    "name" TEXT NOT NULL,
    "officialName" TEXT,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "mask" TEXT,
    "currentBalance" DOUBLE PRECISION,
    "availableBalance" DOUBLE PRECISION,
    "creditLimit" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceBudget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "monthlyLimit" DOUBLE PRECISION NOT NULL,
    "rollover" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceCategoryRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "matchValue" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceCategoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceInstitution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "institutionLogo" TEXT,
    "plaidItemId" TEXT,
    "plaidAccessToken" TEXT,
    "simplefinAccessUrl" TEXT,
    "syncCursor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceInstitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalAssets" DOUBLE PRECISION NOT NULL,
    "totalDebt" DOUBLE PRECISION NOT NULL,
    "netWorth" DOUBLE PRECISION NOT NULL,
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" TEXT NOT NULL,
    "category" TEXT,
    "accountId" TEXT,
    "lastChargeDate" TIMESTAMP(3),
    "nextChargeDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "isWanted" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinanceTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "merchantName" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "category" TEXT,
    "subcategory" TEXT,
    "plaidCategory" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "isPending" BOOLEAN NOT NULL DEFAULT false,
    "isExcluded" BOOLEAN NOT NULL DEFAULT false,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HistorySyncJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "strategy" TEXT NOT NULL DEFAULT 'latest_first',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "insertedTxCount" INTEGER NOT NULL DEFAULT 0,
    "processedSyncs" INTEGER NOT NULL DEFAULT 0,
    "failedSyncs" INTEGER NOT NULL DEFAULT 0,
    "cursorSnapshot" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistorySyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ManualBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "location" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ManualPrice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PortfolioRefreshJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reason" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "staleBefore" TIMESTAMP(3),
    "asOfAfter" TIMESTAMP(3),
    "details" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioRefreshJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PortfolioSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "settings" JSONB,

    CONSTRAINT "PortfolioSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "walletCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProviderCallGate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "leaseOwner" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "nextAllowedAt" TIMESTAMP(3),
    "consecutive429" INTEGER NOT NULL DEFAULT 0,
    "lastStatusCode" INTEGER,
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCallGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProviderUsageMinute" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "minuteBucket" TIMESTAMP(3) NOT NULL,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "rateLimitedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderUsageMinute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RealizedGain" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "disposedAt" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "proceedsUsd" DOUBLE PRECISION NOT NULL,
    "costBasisUsd" DOUBLE PRECISION NOT NULL,
    "gainUsd" DOUBLE PRECISION NOT NULL,
    "txHash" TEXT NOT NULL,
    "holdingPeriod" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealizedGain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StakingPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionKey" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "protocol" TEXT,
    "providerSlug" TEXT,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractAddress" TEXT,
    "underlying" TEXT,
    "maturityDate" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valueUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "apy" DOUBLE PRECISION,
    "apyBase" DOUBLE PRECISION,
    "apyReward" DOUBLE PRECISION,
    "dailyYield" DOUBLE PRECISION,
    "annualYield" DOUBLE PRECISION,
    "depositedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawnUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "claimedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "principalUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yieldEarnedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yieldEarnedPct" DOUBLE PRECISION,
    "dataConfidence" TEXT NOT NULL DEFAULT 'estimated',
    "confidenceReason" TEXT,
    "cacheState" TEXT NOT NULL DEFAULT 'live',
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "frozenAt" TIMESTAMP(3),
    "freezeConfidence" TEXT,
    "dustStreak" INTEGER NOT NULL DEFAULT 0,
    "closeCandidateAt" TIMESTAMP(3),
    "reopenCheckCursor" INTEGER,
    "lastValidatedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "depositedNative" DOUBLE PRECISION,
    "withdrawnNative" DOUBLE PRECISION,
    "nativeSymbol" TEXT,

    CONSTRAINT "StakingPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StakingPositionSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionKey" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "valueUsd" DOUBLE PRECISION NOT NULL,
    "apyTotal" DOUBLE PRECISION,
    "apyBase" DOUBLE PRECISION,
    "apyReward" DOUBLE PRECISION,
    "depositedUsdCumulative" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawnUsdCumulative" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "claimedUsdCumulative" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "principalUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yieldEarnedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyYieldUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dataConfidence" TEXT NOT NULL DEFAULT 'estimated',
    "confidenceReason" TEXT,
    "sourceMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "depositedNativeCumulative" DOUBLE PRECISION,
    "withdrawnNativeCumulative" DOUBLE PRECISION,

    CONSTRAINT "StakingPositionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StakingSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "totalStaked" DOUBLE PRECISION NOT NULL,
    "totalDailyYield" DOUBLE PRECISION NOT NULL,
    "totalAnnualYield" DOUBLE PRECISION NOT NULL,
    "avgApy" DOUBLE PRECISION NOT NULL,
    "totalRewards" DOUBLE PRECISION NOT NULL,
    "positions" JSONB NOT NULL,
    "rewards" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StakingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StakingSyncState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "backfillStartedAt" TIMESTAMP(3),
    "backfillCompletedAt" TIMESTAMP(3),
    "lastHourlySnapshotAt" TIMESTAMP(3),
    "lastWeeklyAuditAt" TIMESTAMP(3),
    "hourlyCursor" TEXT,
    "weeklyCursor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StakingSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrackedWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "chains" TEXT[] DEFAULT ARRAY['ethereum']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TransactionCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "blockTimestamp" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT,
    "asset" TEXT,
    "symbol" TEXT,
    "decimals" INTEGER,
    "rawValue" TEXT,
    "value" DOUBLE PRECISION,
    "usdValue" DOUBLE PRECISION,
    "direction" TEXT NOT NULL,

    CONSTRAINT "TransactionCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TransactionSyncState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "lastBlockFetched" INTEGER NOT NULL DEFAULT 0,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cursorFromBlock" INTEGER,
    "cursorToBlock" INTEGER,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "pageKey" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'bootstrap',
    "recordsInserted" INTEGER NOT NULL DEFAULT 0,
    "requestsProcessed" INTEGER NOT NULL DEFAULT 0,
    "retryAfter" TIMESTAMP(3),

    CONSTRAINT "TransactionSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT,
    "email" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "username" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AddressLabel_userId_address_key" ON "public"."AddressLabel"("userId" ASC, "address" ASC);

-- CreateIndex
CREATE INDEX "AddressLabel_userId_idx" ON "public"."AddressLabel"("userId" ASC);

-- CreateIndex
CREATE INDEX "BalanceSnapshot_fetchedAt_idx" ON "public"."BalanceSnapshot"("fetchedAt" ASC);

-- CreateIndex
CREATE INDEX "BalanceSnapshot_walletId_idx" ON "public"."BalanceSnapshot"("walletId" ASC);

-- CreateIndex
CREATE INDEX "CapitalFlow_userId_flowType_idx" ON "public"."CapitalFlow"("userId" ASC, "flowType" ASC);

-- CreateIndex
CREATE INDEX "CapitalFlow_userId_timestamp_idx" ON "public"."CapitalFlow"("userId" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "ChartCache_userId_timestamp_idx" ON "public"."ChartCache"("userId" ASC, "timestamp" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ChartCache_userId_timestamp_key" ON "public"."ChartCache"("userId" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "CostBasisLot_userId_asset_idx" ON "public"."CostBasisLot"("userId" ASC, "asset" ASC);

-- CreateIndex
CREATE INDEX "CostBasisLot_userId_walletAddress_idx" ON "public"."CostBasisLot"("userId" ASC, "walletAddress" ASC);

-- CreateIndex
CREATE INDEX "CreditCardPerk_cardProfileId_idx" ON "public"."CreditCardPerk"("cardProfileId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardProfile_userId_accountId_key" ON "public"."CreditCardProfile"("userId" ASC, "accountId" ASC);

-- CreateIndex
CREATE INDEX "CreditCardProfile_userId_idx" ON "public"."CreditCardProfile"("userId" ASC);

-- CreateIndex
CREATE INDEX "CreditCardRewardRate_cardProfileId_idx" ON "public"."CreditCardRewardRate"("cardProfileId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardRewardRate_cardProfileId_spendingCategory_key" ON "public"."CreditCardRewardRate"("cardProfileId" ASC, "spendingCategory" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeSyncState_userId_exchangeId_key" ON "public"."ExchangeSyncState"("userId" ASC, "exchangeId" ASC);

-- CreateIndex
CREATE INDEX "ExchangeSyncState_userId_lastSyncedAt_idx" ON "public"."ExchangeSyncState"("userId" ASC, "lastSyncedAt" ASC);

-- CreateIndex
CREATE INDEX "ExchangeSyncState_userId_status_idx" ON "public"."ExchangeSyncState"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "ExchangeTransactionCache_userId_currency_timestamp_idx" ON "public"."ExchangeTransactionCache"("userId" ASC, "currency" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "ExchangeTransactionCache_userId_exchangeId_timestamp_idx" ON "public"."ExchangeTransactionCache"("userId" ASC, "exchangeId" ASC, "timestamp" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeTransactionCache_userId_exchangeId_type_timestamp_c_key" ON "public"."ExchangeTransactionCache"("userId" ASC, "exchangeId" ASC, "type" ASC, "timestamp" ASC, "currency" ASC, "amount" ASC, "txid" ASC, "address" ASC);

-- CreateIndex
CREATE INDEX "ExchangeTransactionCache_userId_source_exchangeId_idx" ON "public"."ExchangeTransactionCache"("userId" ASC, "source" ASC, "exchangeId" ASC);

-- CreateIndex
CREATE INDEX "ExchangeTransactionCache_userId_timestamp_idx" ON "public"."ExchangeTransactionCache"("userId" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "ExternalApiKey_userId_idx" ON "public"."ExternalApiKey"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalApiKey_userId_serviceName_key" ON "public"."ExternalApiKey"("userId" ASC, "serviceName" ASC);

-- CreateIndex
CREATE INDEX "FinanceAccount_institutionId_idx" ON "public"."FinanceAccount"("institutionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceAccount_userId_externalId_key" ON "public"."FinanceAccount"("userId" ASC, "externalId" ASC);

-- CreateIndex
CREATE INDEX "FinanceAccount_userId_idx" ON "public"."FinanceAccount"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBudget_userId_category_key" ON "public"."FinanceBudget"("userId" ASC, "category" ASC);

-- CreateIndex
CREATE INDEX "FinanceBudget_userId_idx" ON "public"."FinanceBudget"("userId" ASC);

-- CreateIndex
CREATE INDEX "FinanceCategoryRule_userId_idx" ON "public"."FinanceCategoryRule"("userId" ASC);

-- CreateIndex
CREATE INDEX "FinanceCredential_userId_idx" ON "public"."FinanceCredential"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCredential_userId_service_key" ON "public"."FinanceCredential"("userId" ASC, "service" ASC);

-- CreateIndex
CREATE INDEX "FinanceInstitution_plaidItemId_idx" ON "public"."FinanceInstitution"("plaidItemId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceInstitution_plaidItemId_key" ON "public"."FinanceInstitution"("plaidItemId" ASC);

-- CreateIndex
CREATE INDEX "FinanceInstitution_userId_idx" ON "public"."FinanceInstitution"("userId" ASC);

-- CreateIndex
CREATE INDEX "FinanceSnapshot_userId_date_idx" ON "public"."FinanceSnapshot"("userId" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSnapshot_userId_date_key" ON "public"."FinanceSnapshot"("userId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "FinanceSubscription_userId_idx" ON "public"."FinanceSubscription"("userId" ASC);

-- CreateIndex
CREATE INDEX "FinanceSubscription_userId_status_idx" ON "public"."FinanceSubscription"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "FinanceTransaction_accountId_date_idx" ON "public"."FinanceTransaction"("accountId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "FinanceTransaction_userId_category_idx" ON "public"."FinanceTransaction"("userId" ASC, "category" ASC);

-- CreateIndex
CREATE INDEX "FinanceTransaction_userId_date_idx" ON "public"."FinanceTransaction"("userId" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTransaction_userId_externalId_key" ON "public"."FinanceTransaction"("userId" ASC, "externalId" ASC);

-- CreateIndex
CREATE INDEX "FinanceTransaction_userId_isRecurring_idx" ON "public"."FinanceTransaction"("userId" ASC, "isRecurring" ASC);

-- CreateIndex
CREATE INDEX "FinanceTransaction_userId_merchantName_idx" ON "public"."FinanceTransaction"("userId" ASC, "merchantName" ASC);

-- CreateIndex
CREATE INDEX "HistorySyncJob_userId_status_idx" ON "public"."HistorySyncJob"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "HistorySyncJob_userId_updatedAt_idx" ON "public"."HistorySyncJob"("userId" ASC, "updatedAt" ASC);

-- CreateIndex
CREATE INDEX "ManualBalance_userId_idx" ON "public"."ManualBalance"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ManualPrice_userId_chain_asset_key" ON "public"."ManualPrice"("userId" ASC, "chain" ASC, "asset" ASC);

-- CreateIndex
CREATE INDEX "ManualPrice_userId_idx" ON "public"."ManualPrice"("userId" ASC);

-- CreateIndex
CREATE INDEX "PortfolioRefreshJob_userId_status_idx" ON "public"."PortfolioRefreshJob"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "PortfolioRefreshJob_userId_updatedAt_idx" ON "public"."PortfolioRefreshJob"("userId" ASC, "updatedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioSetting_userId_key" ON "public"."PortfolioSetting"("userId" ASC);

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_createdAt_idx" ON "public"."PortfolioSnapshot"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_userId_createdAt_idx" ON "public"."PortfolioSnapshot"("userId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_userId_idx" ON "public"."PortfolioSnapshot"("userId" ASC);

-- CreateIndex
CREATE INDEX "ProviderCallGate_provider_nextAllowedAt_idx" ON "public"."ProviderCallGate"("provider" ASC, "nextAllowedAt" ASC);

-- CreateIndex
CREATE INDEX "ProviderCallGate_userId_provider_idx" ON "public"."ProviderCallGate"("userId" ASC, "provider" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCallGate_userId_provider_operationKey_key" ON "public"."ProviderCallGate"("userId" ASC, "provider" ASC, "operationKey" ASC);

-- CreateIndex
CREATE INDEX "ProviderUsageMinute_provider_minuteBucket_idx" ON "public"."ProviderUsageMinute"("provider" ASC, "minuteBucket" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderUsageMinute_provider_minuteBucket_key" ON "public"."ProviderUsageMinute"("provider" ASC, "minuteBucket" ASC);

-- CreateIndex
CREATE INDEX "RealizedGain_userId_asset_idx" ON "public"."RealizedGain"("userId" ASC, "asset" ASC);

-- CreateIndex
CREATE INDEX "RealizedGain_userId_disposedAt_idx" ON "public"."RealizedGain"("userId" ASC, "disposedAt" ASC);

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "public"."Session"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId" ASC);

-- CreateIndex
CREATE INDEX "Settings_key_idx" ON "public"."Settings"("key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Settings_key_key" ON "public"."Settings"("key" ASC);

-- CreateIndex
CREATE INDEX "StakingPosition_userId_cacheState_idx" ON "public"."StakingPosition"("userId" ASC, "cacheState" ASC);

-- CreateIndex
CREATE INDEX "StakingPosition_userId_isFrozen_idx" ON "public"."StakingPosition"("userId" ASC, "isFrozen" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StakingPosition_userId_positionKey_key" ON "public"."StakingPosition"("userId" ASC, "positionKey" ASC);

-- CreateIndex
CREATE INDEX "StakingPosition_userId_status_idx" ON "public"."StakingPosition"("userId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "StakingPositionSnapshot_userId_positionKey_snapshotAt_idx" ON "public"."StakingPositionSnapshot"("userId" ASC, "positionKey" ASC, "snapshotAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StakingPositionSnapshot_userId_positionKey_snapshotAt_key" ON "public"."StakingPositionSnapshot"("userId" ASC, "positionKey" ASC, "snapshotAt" ASC);

-- CreateIndex
CREATE INDEX "StakingPositionSnapshot_userId_snapshotAt_idx" ON "public"."StakingPositionSnapshot"("userId" ASC, "snapshotAt" ASC);

-- CreateIndex
CREATE INDEX "StakingSnapshot_userId_snapshotDate_idx" ON "public"."StakingSnapshot"("userId" ASC, "snapshotDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StakingSnapshot_userId_snapshotDate_key" ON "public"."StakingSnapshot"("userId" ASC, "snapshotDate" ASC);

-- CreateIndex
CREATE INDEX "StakingSyncState_status_idx" ON "public"."StakingSyncState"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StakingSyncState_userId_key" ON "public"."StakingSyncState"("userId" ASC);

-- CreateIndex
CREATE INDEX "TrackedWallet_address_idx" ON "public"."TrackedWallet"("address" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TrackedWallet_userId_address_key" ON "public"."TrackedWallet"("userId" ASC, "address" ASC);

-- CreateIndex
CREATE INDEX "TrackedWallet_userId_idx" ON "public"."TrackedWallet"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionCache_userId_chain_txHash_category_from_to_key" ON "public"."TransactionCache"("userId" ASC, "chain" ASC, "txHash" ASC, "category" ASC, "from" ASC, "to" ASC);

-- CreateIndex
CREATE INDEX "TransactionCache_userId_walletAddress_chain_blockTimestamp_idx" ON "public"."TransactionCache"("userId" ASC, "walletAddress" ASC, "chain" ASC, "blockTimestamp" ASC);

-- CreateIndex
CREATE INDEX "TransactionCache_userId_walletAddress_idx" ON "public"."TransactionCache"("userId" ASC, "walletAddress" ASC);

-- CreateIndex
CREATE INDEX "TransactionSyncState_userId_isComplete_idx" ON "public"."TransactionSyncState"("userId" ASC, "isComplete" ASC);

-- CreateIndex
CREATE INDEX "TransactionSyncState_userId_retryAfter_idx" ON "public"."TransactionSyncState"("userId" ASC, "retryAfter" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionSyncState_userId_walletAddress_chain_key" ON "public"."TransactionSyncState"("userId" ASC, "walletAddress" ASC, "chain" ASC);

-- CreateIndex
CREATE INDEX "User_username_idx" ON "public"."User"("username" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username" ASC);

-- CreateIndex
CREATE INDEX "User_walletAddress_idx" ON "public"."User"("walletAddress" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "public"."User"("walletAddress" ASC);

-- AddForeignKey
ALTER TABLE "public"."AddressLabel" ADD CONSTRAINT "AddressLabel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "public"."TrackedWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CreditCardPerk" ADD CONSTRAINT "CreditCardPerk_cardProfileId_fkey" FOREIGN KEY ("cardProfileId") REFERENCES "public"."CreditCardProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CreditCardRewardRate" ADD CONSTRAINT "CreditCardRewardRate_cardProfileId_fkey" FOREIGN KEY ("cardProfileId") REFERENCES "public"."CreditCardProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExternalApiKey" ADD CONSTRAINT "ExternalApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceAccount" ADD CONSTRAINT "FinanceAccount_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "public"."FinanceInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceCredential" ADD CONSTRAINT "FinanceCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceInstitution" ADD CONSTRAINT "FinanceInstitution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."FinanceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ManualBalance" ADD CONSTRAINT "ManualBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PortfolioRefreshJob" ADD CONSTRAINT "PortfolioRefreshJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PortfolioSetting" ADD CONSTRAINT "PortfolioSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProviderCallGate" ADD CONSTRAINT "ProviderCallGate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StakingPositionSnapshot" ADD CONSTRAINT "StakingPositionSnapshot_userId_positionKey_fkey" FOREIGN KEY ("userId", "positionKey") REFERENCES "public"."StakingPosition"("userId", "positionKey") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrackedWallet" ADD CONSTRAINT "TrackedWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

