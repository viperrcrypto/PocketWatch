/**
 * Individual Plaid product sync functions (identity, liabilities, investments, recurring).
 */

import { db } from "@/lib/db"
import { encryptCredential } from "./crypto"
import { withRetry } from "./retry"
import * as plaid from "./plaid-client"
import { isPlaidProductError, storeRawSnapshot } from "./plaid-sync-helpers"
import type { InstitutionSyncContext, InstitutionReport } from "./plaid-sync-helpers"

export async function syncIdentity(ctx: InstitutionSyncContext, report: InstitutionReport): Promise<void> {
  try {
    const identityData = await withRetry(() => plaid.getIdentity(ctx.userId, ctx.accessToken))
    await storeRawSnapshot(ctx.userId, ctx.institutionId, "identity", identityData)

    for (const acctIdentity of identityData) {
      const internalAccountId = ctx.accountMap.get(acctIdentity.accountId)
      if (!internalAccountId) continue

      const ownersEncrypted = await encryptCredential(JSON.stringify(acctIdentity.owners.map((o) => o.names)))
      const emailsEncrypted = await encryptCredential(JSON.stringify(acctIdentity.owners.flatMap((o) => o.emails)))
      const phonesEncrypted = await encryptCredential(JSON.stringify(acctIdentity.owners.flatMap((o) => o.phoneNumbers)))
      const addrsEncrypted = await encryptCredential(JSON.stringify(acctIdentity.owners.flatMap((o) => o.addresses)))

      await db.financeAccountIdentity.upsert({
        where: { userId_accountId: { userId: ctx.userId, accountId: internalAccountId } },
        create: {
          userId: ctx.userId, accountId: internalAccountId,
          ownerNames: ownersEncrypted, emails: emailsEncrypted,
          phoneNumbers: phonesEncrypted, addresses: addrsEncrypted,
        },
        update: {
          ownerNames: ownersEncrypted, emails: emailsEncrypted,
          phoneNumbers: phonesEncrypted, addresses: addrsEncrypted,
        },
      })
    }
    report.synced.push("identity")
  } catch (err) {
    if (isPlaidProductError(err)) {
      report.skipped.push("identity")
    } else {
      report.errors.push(`identity: ${err instanceof Error ? err.message : "unknown"}`)
    }
  }
}

export async function syncLiabilities(ctx: InstitutionSyncContext, report: InstitutionReport): Promise<void> {
  if (!ctx.availableProducts.has("liabilities")) {
    report.skipped.push("liabilities")
    return
  }

  try {
    const liabData = await withRetry(() => plaid.getLiabilities(ctx.userId, ctx.accessToken))
    await storeRawSnapshot(ctx.userId, ctx.institutionId, "liabilities", liabData)

    for (const cc of liabData.credit) {
      const internalId = ctx.accountMap.get(cc.accountId)
      if (!internalId) continue
      await db.financeLiabilityCreditCard.upsert({
        where: { userId_accountId: { userId: ctx.userId, accountId: internalId } },
        create: {
          userId: ctx.userId, accountId: internalId, isOverdue: cc.isOverdue,
          lastPaymentAmount: cc.lastPaymentAmount,
          lastPaymentDate: cc.lastPaymentDate ? new Date(cc.lastPaymentDate) : null,
          lastStatementBalance: cc.lastStatementBalance,
          lastStatementDate: cc.lastStatementDate ? new Date(cc.lastStatementDate) : null,
          minimumPaymentAmount: cc.minimumPaymentAmount,
          nextPaymentDueDate: cc.nextPaymentDueDate ? new Date(cc.nextPaymentDueDate) : null,
          aprs: cc.aprs,
        },
        update: {
          isOverdue: cc.isOverdue, lastPaymentAmount: cc.lastPaymentAmount,
          lastPaymentDate: cc.lastPaymentDate ? new Date(cc.lastPaymentDate) : null,
          lastStatementBalance: cc.lastStatementBalance,
          lastStatementDate: cc.lastStatementDate ? new Date(cc.lastStatementDate) : null,
          minimumPaymentAmount: cc.minimumPaymentAmount,
          nextPaymentDueDate: cc.nextPaymentDueDate ? new Date(cc.nextPaymentDueDate) : null,
          aprs: cc.aprs,
        },
      })
    }

    for (const m of liabData.mortgage) {
      const internalId = ctx.accountMap.get(m.accountId)
      if (!internalId) continue
      const propAddr = m.propertyAddress ? await encryptCredential(JSON.stringify(m.propertyAddress)) : null
      await db.financeLiabilityMortgage.upsert({
        where: { userId_accountId: { userId: ctx.userId, accountId: internalId } },
        create: {
          userId: ctx.userId, accountId: internalId,
          interestRateType: m.interestRateType, interestRatePercent: m.interestRatePercent,
          currentLateFee: m.currentLateFee, escrowBalance: m.escrowBalance,
          hasPmi: m.hasPmi, hasPrepaymentPenalty: m.hasPrepaymentPenalty,
          lastPaymentAmount: m.lastPaymentAmount,
          lastPaymentDate: m.lastPaymentDate ? new Date(m.lastPaymentDate) : null,
          loanTerm: m.loanTerm, loanTypeDescription: m.loanTypeDescription,
          maturityDate: m.maturityDate ? new Date(m.maturityDate) : null,
          nextMonthlyPayment: m.nextMonthlyPayment,
          nextPaymentDueDate: m.nextPaymentDueDate ? new Date(m.nextPaymentDueDate) : null,
          originationDate: m.originationDate ? new Date(m.originationDate) : null,
          originationPrincipal: m.originationPrincipalAmount,
          pastDueAmount: m.pastDueAmount, propertyAddress: propAddr,
          ytdInterestPaid: m.ytdInterestPaid, ytdPrincipalPaid: m.ytdPrincipalPaid,
        },
        update: {
          interestRateType: m.interestRateType, interestRatePercent: m.interestRatePercent,
          currentLateFee: m.currentLateFee, escrowBalance: m.escrowBalance,
          hasPmi: m.hasPmi, hasPrepaymentPenalty: m.hasPrepaymentPenalty,
          lastPaymentAmount: m.lastPaymentAmount,
          lastPaymentDate: m.lastPaymentDate ? new Date(m.lastPaymentDate) : null,
          nextMonthlyPayment: m.nextMonthlyPayment,
          nextPaymentDueDate: m.nextPaymentDueDate ? new Date(m.nextPaymentDueDate) : null,
          pastDueAmount: m.pastDueAmount, propertyAddress: propAddr,
          ytdInterestPaid: m.ytdInterestPaid, ytdPrincipalPaid: m.ytdPrincipalPaid,
        },
      })
    }

    for (const s of liabData.student) {
      const internalId = ctx.accountMap.get(s.accountId)
      if (!internalId) continue
      const svcAddr = s.servicerAddress ? await encryptCredential(JSON.stringify(s.servicerAddress)) : null
      const disbDates = s.disbursementDates.length > 0 ? await encryptCredential(JSON.stringify(s.disbursementDates)) : null
      await db.financeLiabilityStudentLoan.upsert({
        where: { userId_accountId: { userId: ctx.userId, accountId: internalId } },
        create: {
          userId: ctx.userId, accountId: internalId,
          expectedPayoffDate: s.expectedPayoffDate ? new Date(s.expectedPayoffDate) : null,
          guarantor: s.guarantor, interestRatePercent: s.interestRatePercent,
          isOverdue: s.isOverdue, lastPaymentAmount: s.lastPaymentAmount,
          lastPaymentDate: s.lastPaymentDate ? new Date(s.lastPaymentDate) : null,
          lastStatementBalance: s.lastStatementBalance,
          lastStatementDate: s.lastStatementDate ? new Date(s.lastStatementDate) : null,
          loanName: s.loanName, loanStatusType: s.loanStatusType,
          loanStatusEndDate: s.loanStatusEndDate ? new Date(s.loanStatusEndDate) : null,
          minimumPaymentAmount: s.minimumPaymentAmount,
          nextPaymentDueDate: s.nextPaymentDueDate ? new Date(s.nextPaymentDueDate) : null,
          originationDate: s.originationDate ? new Date(s.originationDate) : null,
          originationPrincipal: s.originationPrincipalAmount,
          outstandingInterest: s.outstandingInterestAmount,
          paymentReferenceNumber: s.paymentReferenceNumber,
          repaymentPlanType: s.repaymentPlanType,
          repaymentPlanDescription: s.repaymentPlanDescription,
          servicerAddress: svcAddr, disbursementDates: disbDates,
          ytdInterestPaid: s.ytdInterestPaid, ytdPrincipalPaid: s.ytdPrincipalPaid,
        },
        update: {
          interestRatePercent: s.interestRatePercent, isOverdue: s.isOverdue,
          lastPaymentAmount: s.lastPaymentAmount,
          lastPaymentDate: s.lastPaymentDate ? new Date(s.lastPaymentDate) : null,
          lastStatementBalance: s.lastStatementBalance,
          minimumPaymentAmount: s.minimumPaymentAmount,
          nextPaymentDueDate: s.nextPaymentDueDate ? new Date(s.nextPaymentDueDate) : null,
          outstandingInterest: s.outstandingInterestAmount,
          servicerAddress: svcAddr,
          ytdInterestPaid: s.ytdInterestPaid, ytdPrincipalPaid: s.ytdPrincipalPaid,
        },
      })
    }

    report.synced.push("liabilities")
  } catch (err) {
    if (isPlaidProductError(err)) {
      report.skipped.push("liabilities")
    } else {
      report.errors.push(`liabilities: ${err instanceof Error ? err.message : "unknown"}`)
    }
  }
}

export async function syncInvestments(ctx: InstitutionSyncContext, report: InstitutionReport): Promise<void> {
  if (!ctx.availableProducts.has("investments")) {
    report.skipped.push("investments_holdings", "investments_transactions")
    return
  }

  // Holdings
  try {
    const holdingsData = await withRetry(() => plaid.getInvestmentHoldings(ctx.userId, ctx.accessToken))
    await storeRawSnapshot(ctx.userId, ctx.institutionId, "investments_holdings", holdingsData)

    for (const sec of holdingsData.securities) {
      await db.financeInvestmentSecurity.upsert({
        where: { userId_securityId: { userId: ctx.userId, securityId: sec.securityId } },
        create: {
          userId: ctx.userId, securityId: sec.securityId, isin: sec.isin, cusip: sec.cusip, sedol: sec.sedol,
          institutionSecurityId: sec.institutionSecurityId, institutionId: sec.institutionId,
          proxySecurityId: sec.proxySecurityId, name: sec.name, tickerSymbol: sec.tickerSymbol,
          isCashEquivalent: sec.isCashEquivalent, type: sec.type,
          closePrice: sec.closePrice,
          closePriceAsOf: sec.closePriceAsOf ? new Date(sec.closePriceAsOf) : null,
          isoCurrencyCode: sec.isoCurrencyCode, unofficialCurrencyCode: sec.unofficialCurrencyCode,
          marketIdentifierCode: sec.marketIdentifierCode,
          sector: sec.sector, industry: sec.industry,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Plaid SDK type
          optionContract: (sec.optionContract as any) ?? undefined,
        },
        update: {
          name: sec.name, tickerSymbol: sec.tickerSymbol, type: sec.type,
          closePrice: sec.closePrice,
          closePriceAsOf: sec.closePriceAsOf ? new Date(sec.closePriceAsOf) : null,
          sector: sec.sector, industry: sec.industry,
        },
      })
    }

    for (const h of holdingsData.holdings) {
      const internalId = ctx.accountMap.get(h.accountId)
      if (!internalId) continue
      await db.financeInvestmentHolding.upsert({
        where: { userId_accountId_securityId: { userId: ctx.userId, accountId: internalId, securityId: h.securityId ?? "" } },
        create: {
          userId: ctx.userId, accountId: internalId, securityId: h.securityId,
          costBasis: h.costBasis, institutionPrice: h.institutionPrice,
          institutionPriceAsOf: h.institutionPriceAsOf ? new Date(h.institutionPriceAsOf) : null,
          institutionValue: h.institutionValue, isoCurrencyCode: h.isoCurrencyCode,
          quantity: h.quantity, unofficialCurrencyCode: h.unofficialCurrencyCode,
          vestedQuantity: h.vestedQuantity, vestedValue: h.vestedValue,
        },
        update: {
          costBasis: h.costBasis, institutionPrice: h.institutionPrice,
          institutionPriceAsOf: h.institutionPriceAsOf ? new Date(h.institutionPriceAsOf) : null,
          institutionValue: h.institutionValue, quantity: h.quantity,
          vestedQuantity: h.vestedQuantity, vestedValue: h.vestedValue,
        },
      })
    }

    // Daily holding snapshots
    const now = new Date()
    const snapshotDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    for (const h of holdingsData.holdings) {
      const internalId = ctx.accountMap.get(h.accountId)
      if (!internalId) continue
      await db.financeInvestmentHoldingSnapshot.upsert({
        where: { userId_accountId_securityId_date: { userId: ctx.userId, accountId: internalId, securityId: h.securityId ?? "", date: snapshotDate } },
        create: { userId: ctx.userId, accountId: internalId, securityId: h.securityId, date: snapshotDate, quantity: h.quantity, institutionPrice: h.institutionPrice, institutionValue: h.institutionValue, costBasis: h.costBasis },
        update: { quantity: h.quantity, institutionPrice: h.institutionPrice, institutionValue: h.institutionValue, costBasis: h.costBasis },
      })
    }

    report.synced.push("investments_holdings")
  } catch (err) {
    if (isPlaidProductError(err)) {
      report.skipped.push("investments_holdings")
    } else {
      report.errors.push(`investments_holdings: ${err instanceof Error ? err.message : "unknown"}`)
    }
  }

  // Transactions (2-year window)
  try {
    const endDate = new Date().toISOString().split("T")[0]
    const startObj = new Date()
    startObj.setFullYear(startObj.getFullYear() - 2)
    const startDate = startObj.toISOString().split("T")[0]

    const invTxs = await withRetry(() => plaid.getInvestmentTransactions(ctx.userId, ctx.accessToken, startDate, endDate))
    await storeRawSnapshot(ctx.userId, ctx.institutionId, "investments_transactions", invTxs)

    for (const t of invTxs) {
      const internalId = ctx.accountMap.get(t.accountId)
      if (!internalId) continue
      await db.financeInvestmentTransaction.upsert({
        where: { userId_investmentTransactionId: { userId: ctx.userId, investmentTransactionId: t.investmentTransactionId } },
        create: {
          userId: ctx.userId, accountId: internalId, securityId: t.securityId,
          investmentTransactionId: t.investmentTransactionId,
          date: new Date(t.date), name: t.name, quantity: t.quantity,
          amount: t.amount, price: t.price, fees: t.fees,
          type: t.type, subtype: t.subtype,
          isoCurrencyCode: t.isoCurrencyCode, unofficialCurrencyCode: t.unofficialCurrencyCode,
        },
        update: { name: t.name, quantity: t.quantity, amount: t.amount, price: t.price, fees: t.fees },
      })
    }
    report.synced.push("investments_transactions")
  } catch (err) {
    if (isPlaidProductError(err)) {
      report.skipped.push("investments_transactions")
    } else {
      report.errors.push(`investments_transactions: ${err instanceof Error ? err.message : "unknown"}`)
    }
  }
}

export async function syncRecurring(ctx: InstitutionSyncContext, report: InstitutionReport): Promise<void> {
  try {
    const recurring = await withRetry(() =>
      plaid.getRecurringTransactions(ctx.userId, ctx.accessToken, ctx.accountExternalIds)
    )
    await storeRawSnapshot(ctx.userId, ctx.institutionId, "recurring", recurring)

    const allStreams = [
      ...recurring.inflowStreams.map((s) => ({ ...s, streamType: "inflow" as const })),
      ...recurring.outflowStreams.map((s) => ({ ...s, streamType: "outflow" as const })),
    ]

    for (const s of allStreams) {
      const internalId = ctx.accountMap.get(s.accountId)
      if (!internalId) continue
      await db.financeRecurringStream.upsert({
        where: { userId_streamId: { userId: ctx.userId, streamId: s.streamId } },
        create: {
          userId: ctx.userId, streamId: s.streamId, accountId: internalId,
          category: s.category, description: s.description, merchantName: s.merchantName,
          firstDate: s.firstDate ? new Date(s.firstDate) : null,
          lastDate: s.lastDate ? new Date(s.lastDate) : null,
          frequency: s.frequency, averageAmount: s.averageAmount,
          lastAmount: s.lastAmount, isActive: s.isActive, status: s.status,
          personalFinanceCategory: s.personalFinanceCategory ?? undefined,
          streamType: s.streamType, transactionIds: s.transactionIds,
        },
        update: {
          category: s.category, description: s.description, merchantName: s.merchantName,
          lastDate: s.lastDate ? new Date(s.lastDate) : null,
          frequency: s.frequency, averageAmount: s.averageAmount,
          lastAmount: s.lastAmount, isActive: s.isActive, status: s.status,
          personalFinanceCategory: s.personalFinanceCategory ?? undefined,
          transactionIds: s.transactionIds,
        },
      })
    }
    report.synced.push("recurring")
  } catch (err) {
    if (isPlaidProductError(err)) {
      report.skipped.push("recurring")
    } else {
      report.errors.push(`recurring: ${err instanceof Error ? err.message : "unknown"}`)
    }
  }
}
