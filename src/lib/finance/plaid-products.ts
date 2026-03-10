/**
 * Plaid product-specific API calls: identity, liabilities, investments.
 */

import { getPlaidClient } from "./plaid-types"
import type { PlaidIdentityAccount } from "./plaid-types"

// ─── Identity ──────────────────────────────────────────────────

export async function getIdentity(
  userId: string,
  accessToken: string
): Promise<PlaidIdentityAccount[]> {
  const client = await getPlaidClient(userId)
  const response = await client.identityGet({ access_token: accessToken })
  return response.data.accounts.map((a) => ({
    accountId: a.account_id,
    owners: (a.owners ?? []).map((o) => ({
      names: o.names ?? [],
      emails: (o.emails ?? []).map((e) => ({ data: e.data, primary: e.primary, type: String(e.type) })),
      phoneNumbers: (o.phone_numbers ?? []).map((p) => ({ data: p.data, primary: p.primary, type: String(p.type) })),
      addresses: (o.addresses ?? []).map((addr) => ({
        data: {
          street: addr.data?.street ?? null, city: addr.data?.city ?? null,
          region: addr.data?.region ?? null, postalCode: addr.data?.postal_code ?? null,
          country: addr.data?.country ?? null,
        },
        primary: addr.primary ?? false,
      })),
    })),
  }))
}

// ─── Liabilities ───────────────────────────────────────────────

export interface PlaidLiabilities {
  credit: Array<{
    accountId: string; isOverdue: boolean
    lastPaymentAmount: number | null; lastPaymentDate: string | null
    lastStatementBalance: number | null; lastStatementDate: string | null
    minimumPaymentAmount: number | null; nextPaymentDueDate: string | null
    aprs: Array<{ aprPercentage: number; aprType: string; balanceSubjectToApr: number | null }>
  }>
  mortgage: Array<{
    accountId: string; interestRateType: string | null; interestRatePercent: number | null
    currentLateFee: number | null; escrowBalance: number | null
    hasPmi: boolean; hasPrepaymentPenalty: boolean
    lastPaymentAmount: number | null; lastPaymentDate: string | null
    loanTerm: string | null; loanTypeDescription: string | null; maturityDate: string | null
    nextMonthlyPayment: number | null; nextPaymentDueDate: string | null
    originationDate: string | null; originationPrincipalAmount: number | null
    pastDueAmount: number | null; propertyAddress: Record<string, string | null> | null
    ytdInterestPaid: number | null; ytdPrincipalPaid: number | null
  }>
  student: Array<{
    accountId: string; expectedPayoffDate: string | null; guarantor: string | null
    interestRatePercent: number | null; isOverdue: boolean
    lastPaymentAmount: number | null; lastPaymentDate: string | null
    lastStatementBalance: number | null; lastStatementDate: string | null
    loanName: string | null; loanStatusType: string | null; loanStatusEndDate: string | null
    minimumPaymentAmount: number | null; nextPaymentDueDate: string | null
    originationDate: string | null; originationPrincipalAmount: number | null
    outstandingInterestAmount: number | null; paymentReferenceNumber: string | null
    repaymentPlanType: string | null; repaymentPlanDescription: string | null
    servicerAddress: Record<string, string | null> | null
    ytdInterestPaid: number | null; ytdPrincipalPaid: number | null
    disbursementDates: string[]
  }>
}

export async function getLiabilities(
  userId: string,
  accessToken: string
): Promise<PlaidLiabilities> {
  const client = await getPlaidClient(userId)
  const response = await client.liabilitiesGet({ access_token: accessToken })
  const liabs = response.data.liabilities
  return {
    credit: (liabs.credit ?? []).map((c) => ({
      accountId: c.account_id!,
      isOverdue: c.is_overdue ?? false,
      lastPaymentAmount: c.last_payment_amount ?? null,
      lastPaymentDate: c.last_payment_date ?? null,
      lastStatementBalance: c.last_statement_balance ?? null,
      lastStatementDate: c.last_statement_issue_date ?? null,
      minimumPaymentAmount: c.minimum_payment_amount ?? null,
      nextPaymentDueDate: c.next_payment_due_date ?? null,
      aprs: (c.aprs ?? []).map((a) => ({
        aprPercentage: a.apr_percentage, aprType: a.apr_type,
        balanceSubjectToApr: a.balance_subject_to_apr ?? null,
      })),
    })),
    mortgage: (liabs.mortgage ?? []).map((m) => ({
      accountId: m.account_id,
      interestRateType: m.interest_rate?.type ?? null,
      interestRatePercent: m.interest_rate?.percentage ?? null,
      currentLateFee: m.current_late_fee ?? null,
      escrowBalance: m.escrow_balance ?? null,
      hasPmi: m.has_pmi ?? false,
      hasPrepaymentPenalty: m.has_prepayment_penalty ?? false,
      lastPaymentAmount: m.last_payment_amount ?? null,
      lastPaymentDate: m.last_payment_date ?? null,
      loanTerm: m.loan_term ?? null,
      loanTypeDescription: m.loan_type_description ?? null,
      maturityDate: m.maturity_date ?? null,
      nextMonthlyPayment: m.next_monthly_payment ?? null,
      nextPaymentDueDate: m.next_payment_due_date ?? null,
      originationDate: m.origination_date ?? null,
      originationPrincipalAmount: m.origination_principal_amount ?? null,
      pastDueAmount: m.past_due_amount ?? null,
      propertyAddress: m.property_address ? {
        street: m.property_address.street ?? null, city: m.property_address.city ?? null,
        region: m.property_address.region ?? null, postalCode: m.property_address.postal_code ?? null,
        country: m.property_address.country ?? null,
      } : null,
      ytdInterestPaid: m.ytd_interest_paid ?? null,
      ytdPrincipalPaid: m.ytd_principal_paid ?? null,
    })),
    student: (liabs.student ?? []).map((s) => ({
      accountId: s.account_id!,
      expectedPayoffDate: s.expected_payoff_date ?? null,
      guarantor: s.guarantor ?? null,
      interestRatePercent: s.interest_rate_percentage ?? null,
      isOverdue: s.is_overdue ?? false,
      lastPaymentAmount: s.last_payment_amount ?? null,
      lastPaymentDate: s.last_payment_date ?? null,
      lastStatementBalance: s.last_statement_balance ?? null,
      lastStatementDate: s.last_statement_issue_date ?? null,
      loanName: s.loan_name ?? null,
      loanStatusType: s.loan_status?.type ?? null,
      loanStatusEndDate: s.loan_status?.end_date ?? null,
      minimumPaymentAmount: s.minimum_payment_amount ?? null,
      nextPaymentDueDate: s.next_payment_due_date ?? null,
      originationDate: s.origination_date ?? null,
      originationPrincipalAmount: s.origination_principal_amount ?? null,
      outstandingInterestAmount: s.outstanding_interest_amount ?? null,
      paymentReferenceNumber: s.payment_reference_number ?? null,
      repaymentPlanType: s.repayment_plan?.type ?? null,
      repaymentPlanDescription: s.repayment_plan?.description ?? null,
      servicerAddress: s.servicer_address ? {
        street: s.servicer_address.street ?? null, city: s.servicer_address.city ?? null,
        region: s.servicer_address.region ?? null, postalCode: s.servicer_address.postal_code ?? null,
        country: s.servicer_address.country ?? null,
      } : null,
      ytdInterestPaid: s.ytd_interest_paid ?? null,
      ytdPrincipalPaid: s.ytd_principal_paid ?? null,
      disbursementDates: s.disbursement_dates ?? [],
    })),
  }
}

// ─── Investments ───────────────────────────────────────────────

export interface PlaidInvestmentHolding {
  accountId: string; securityId: string | null; costBasis: number | null
  institutionPrice: number | null; institutionPriceAsOf: string | null
  institutionValue: number | null; isoCurrencyCode: string | null
  quantity: number | null; unofficialCurrencyCode: string | null
  vestedQuantity: number | null; vestedValue: number | null
}

export interface PlaidInvestmentSecurity {
  securityId: string; isin: string | null; cusip: string | null; sedol: string | null
  institutionSecurityId: string | null; institutionId: string | null
  proxySecurityId: string | null; name: string | null; tickerSymbol: string | null
  isCashEquivalent: boolean; type: string | null
  closePrice: number | null; closePriceAsOf: string | null
  isoCurrencyCode: string | null; unofficialCurrencyCode: string | null
  marketIdentifierCode: string | null; sector: string | null; industry: string | null
  optionContract: Record<string, unknown> | null
}

export interface PlaidInvestmentTransaction {
  investmentTransactionId: string; accountId: string; securityId: string | null
  date: string; name: string; quantity: number | null; amount: number
  price: number | null; fees: number | null; type: string; subtype: string | null
  isoCurrencyCode: string | null; unofficialCurrencyCode: string | null
}

export async function getInvestmentHoldings(
  userId: string,
  accessToken: string
): Promise<{ holdings: PlaidInvestmentHolding[]; securities: PlaidInvestmentSecurity[] }> {
  const client = await getPlaidClient(userId)
  const response = await client.investmentsHoldingsGet({ access_token: accessToken })
  return {
    holdings: response.data.holdings.map((h) => ({
      accountId: h.account_id, securityId: h.security_id,
      costBasis: h.cost_basis ?? null, institutionPrice: h.institution_price ?? null,
      institutionPriceAsOf: h.institution_price_as_of ?? null,
      institutionValue: h.institution_value ?? null,
      isoCurrencyCode: h.iso_currency_code ?? null, quantity: h.quantity ?? null,
      unofficialCurrencyCode: h.unofficial_currency_code ?? null,
      vestedQuantity: h.vested_quantity ?? null, vestedValue: h.vested_value ?? null,
    })),
    securities: response.data.securities.map((s) => ({
      securityId: s.security_id, isin: s.isin ?? null, cusip: s.cusip ?? null, sedol: s.sedol ?? null,
      institutionSecurityId: s.institution_security_id ?? null,
      institutionId: s.institution_id ?? null, proxySecurityId: s.proxy_security_id ?? null,
      name: s.name ?? null, tickerSymbol: s.ticker_symbol ?? null,
      isCashEquivalent: s.is_cash_equivalent ?? false, type: s.type ?? null,
      closePrice: s.close_price ?? null, closePriceAsOf: s.close_price_as_of ?? null,
      isoCurrencyCode: s.iso_currency_code ?? null,
      unofficialCurrencyCode: s.unofficial_currency_code ?? null,
      marketIdentifierCode: s.market_identifier_code ?? null,
      sector: (s as any).sector ?? null, industry: (s as any).industry ?? null,
      optionContract: (s as any).option_contract ?? null,
    })),
  }
}

export async function getInvestmentTransactions(
  userId: string,
  accessToken: string,
  startDate: string,
  endDate: string,
): Promise<PlaidInvestmentTransaction[]> {
  const client = await getPlaidClient(userId)
  const allTxs: PlaidInvestmentTransaction[] = []
  let offset = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.investmentsTransactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count: 500, offset },
    })
    const mapped = response.data.investment_transactions.map((t) => ({
      investmentTransactionId: t.investment_transaction_id,
      accountId: t.account_id, securityId: t.security_id ?? null,
      date: t.date, name: t.name, quantity: t.quantity ?? null,
      amount: t.amount, price: t.price ?? null, fees: t.fees ?? null,
      type: t.type, subtype: t.subtype ?? null,
      isoCurrencyCode: t.iso_currency_code ?? null,
      unofficialCurrencyCode: t.unofficial_currency_code ?? null,
    }))
    allTxs.push(...mapped)
    offset += mapped.length
    if (offset >= response.data.total_investment_transactions || mapped.length === 0) break
  }
  return allTxs
}
