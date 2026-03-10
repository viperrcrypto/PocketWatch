-- AlterTable
ALTER TABLE "FinanceTransaction" ADD COLUMN     "authorizedDate" DATE,
ADD COLUMN     "checkNumber" TEXT,
ADD COLUMN     "counterparties" JSONB,
ADD COLUMN     "location" JSONB,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "merchantEntityId" TEXT,
ADD COLUMN     "paymentChannel" TEXT,
ADD COLUMN     "paymentMeta" JSONB,
ADD COLUMN     "transactionCode" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "PlaidDataSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "encryptedData" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaidDataSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceAccountIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ownerNames" TEXT NOT NULL,
    "emails" TEXT,
    "phoneNumbers" TEXT,
    "addresses" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceAccountIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceLiabilityCreditCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "lastPaymentAmount" DOUBLE PRECISION,
    "lastPaymentDate" TIMESTAMP(3),
    "lastStatementBalance" DOUBLE PRECISION,
    "lastStatementDate" TIMESTAMP(3),
    "minimumPaymentAmount" DOUBLE PRECISION,
    "nextPaymentDueDate" TIMESTAMP(3),
    "aprs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceLiabilityCreditCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceLiabilityMortgage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "interestRateType" TEXT,
    "interestRatePercent" DOUBLE PRECISION,
    "currentLateFee" DOUBLE PRECISION,
    "escrowBalance" DOUBLE PRECISION,
    "hasPmi" BOOLEAN NOT NULL DEFAULT false,
    "hasPrepaymentPenalty" BOOLEAN NOT NULL DEFAULT false,
    "lastPaymentAmount" DOUBLE PRECISION,
    "lastPaymentDate" TIMESTAMP(3),
    "loanTerm" TEXT,
    "loanTypeDescription" TEXT,
    "maturityDate" TIMESTAMP(3),
    "nextMonthlyPayment" DOUBLE PRECISION,
    "nextPaymentDueDate" TIMESTAMP(3),
    "originationDate" TIMESTAMP(3),
    "originationPrincipal" DOUBLE PRECISION,
    "pastDueAmount" DOUBLE PRECISION,
    "propertyAddress" TEXT,
    "ytdInterestPaid" DOUBLE PRECISION,
    "ytdPrincipalPaid" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceLiabilityMortgage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceLiabilityStudentLoan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "expectedPayoffDate" TIMESTAMP(3),
    "guarantor" TEXT,
    "interestRatePercent" DOUBLE PRECISION,
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "lastPaymentAmount" DOUBLE PRECISION,
    "lastPaymentDate" TIMESTAMP(3),
    "lastStatementBalance" DOUBLE PRECISION,
    "lastStatementDate" TIMESTAMP(3),
    "loanName" TEXT,
    "loanStatusType" TEXT,
    "loanStatusEndDate" TIMESTAMP(3),
    "minimumPaymentAmount" DOUBLE PRECISION,
    "nextPaymentDueDate" TIMESTAMP(3),
    "originationDate" TIMESTAMP(3),
    "originationPrincipal" DOUBLE PRECISION,
    "outstandingInterest" DOUBLE PRECISION,
    "paymentReferenceNumber" TEXT,
    "repaymentPlanType" TEXT,
    "repaymentPlanDescription" TEXT,
    "servicerAddress" TEXT,
    "ytdInterestPaid" DOUBLE PRECISION,
    "ytdPrincipalPaid" DOUBLE PRECISION,
    "disbursementDates" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceLiabilityStudentLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceInvestmentHolding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "securityId" TEXT,
    "costBasis" DOUBLE PRECISION,
    "institutionPrice" DOUBLE PRECISION,
    "institutionPriceAsOf" TIMESTAMP(3),
    "institutionValue" DOUBLE PRECISION,
    "isoCurrencyCode" TEXT,
    "quantity" DOUBLE PRECISION,
    "unofficialCurrencyCode" TEXT,
    "vestedQuantity" DOUBLE PRECISION,
    "vestedValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceInvestmentHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceInvestmentSecurity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "securityId" TEXT NOT NULL,
    "isin" TEXT,
    "cusip" TEXT,
    "sedol" TEXT,
    "institutionSecurityId" TEXT,
    "institutionId" TEXT,
    "proxySecurityId" TEXT,
    "name" TEXT,
    "tickerSymbol" TEXT,
    "isCashEquivalent" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT,
    "closePrice" DOUBLE PRECISION,
    "closePriceAsOf" TIMESTAMP(3),
    "isoCurrencyCode" TEXT,
    "unofficialCurrencyCode" TEXT,
    "marketIdentifierCode" TEXT,
    "sector" TEXT,
    "industry" TEXT,
    "optionContract" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceInvestmentSecurity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceInvestmentTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "securityId" TEXT,
    "investmentTransactionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION,
    "fees" DOUBLE PRECISION,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "isoCurrencyCode" TEXT,
    "unofficialCurrencyCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceInvestmentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceRecurringStream" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "merchantName" TEXT,
    "firstDate" TIMESTAMP(3),
    "lastDate" TIMESTAMP(3),
    "frequency" TEXT NOT NULL,
    "averageAmount" DOUBLE PRECISION,
    "lastAmount" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL,
    "personalFinanceCategory" JSONB,
    "streamType" TEXT NOT NULL,
    "transactionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceRecurringStream_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaidDataSnapshot_userId_institutionId_idx" ON "PlaidDataSnapshot"("userId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaidDataSnapshot_userId_institutionId_dataType_key" ON "PlaidDataSnapshot"("userId", "institutionId", "dataType");

-- CreateIndex
CREATE INDEX "FinanceAccountIdentity_userId_idx" ON "FinanceAccountIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceAccountIdentity_userId_accountId_key" ON "FinanceAccountIdentity"("userId", "accountId");

-- CreateIndex
CREATE INDEX "FinanceLiabilityCreditCard_userId_idx" ON "FinanceLiabilityCreditCard"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceLiabilityCreditCard_userId_accountId_key" ON "FinanceLiabilityCreditCard"("userId", "accountId");

-- CreateIndex
CREATE INDEX "FinanceLiabilityMortgage_userId_idx" ON "FinanceLiabilityMortgage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceLiabilityMortgage_userId_accountId_key" ON "FinanceLiabilityMortgage"("userId", "accountId");

-- CreateIndex
CREATE INDEX "FinanceLiabilityStudentLoan_userId_idx" ON "FinanceLiabilityStudentLoan"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceLiabilityStudentLoan_userId_accountId_key" ON "FinanceLiabilityStudentLoan"("userId", "accountId");

-- CreateIndex
CREATE INDEX "FinanceInvestmentHolding_userId_idx" ON "FinanceInvestmentHolding"("userId");

-- CreateIndex
CREATE INDEX "FinanceInvestmentHolding_userId_accountId_idx" ON "FinanceInvestmentHolding"("userId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceInvestmentHolding_userId_accountId_securityId_key" ON "FinanceInvestmentHolding"("userId", "accountId", "securityId");

-- CreateIndex
CREATE INDEX "FinanceInvestmentSecurity_userId_idx" ON "FinanceInvestmentSecurity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceInvestmentSecurity_userId_securityId_key" ON "FinanceInvestmentSecurity"("userId", "securityId");

-- CreateIndex
CREATE INDEX "FinanceInvestmentTransaction_userId_date_idx" ON "FinanceInvestmentTransaction"("userId", "date");

-- CreateIndex
CREATE INDEX "FinanceInvestmentTransaction_userId_accountId_idx" ON "FinanceInvestmentTransaction"("userId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceInvestmentTransaction_userId_investmentTransactionId_key" ON "FinanceInvestmentTransaction"("userId", "investmentTransactionId");

-- CreateIndex
CREATE INDEX "FinanceRecurringStream_userId_idx" ON "FinanceRecurringStream"("userId");

-- CreateIndex
CREATE INDEX "FinanceRecurringStream_userId_streamType_idx" ON "FinanceRecurringStream"("userId", "streamType");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceRecurringStream_userId_streamId_key" ON "FinanceRecurringStream"("userId", "streamId");
