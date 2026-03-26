/**
 * Table registry for backup export/import.
 * Defines every Prisma model with its dependency tier and metadata.
 *
 * Tables are inserted in tier order during import to respect foreign keys.
 * Session, ProviderCallGate, and ProviderUsageMinute are excluded
 * (ephemeral state that rebuilds naturally).
 */

import type { PrismaClient } from "@/generated/prisma/client"

export interface BackupTable {
  /** Prisma model name (PascalCase, matches schema) */
  name: string
  /** Dependency tier — lower tiers are inserted first */
  tier: number
  /** If true, reset "running" status to "completed" on import */
  resetJobStatus?: boolean
  /** Fields that contain @updatedAt which Prisma auto-sets on insert */
  updatedAtField?: string
}

/**
 * All tables to backup, ordered by dependency tier.
 * Tier 0: No dependencies
 * Tier 1: User (root)
 * Tier 2: Depends on User only
 * Tier 3: Depends on TrackedWallet or FinanceInstitution
 * Tier 4: Depends on FinanceAccount or CreditCardProfile
 * Tier 5: Depends on CreditCardPerk or StakingPosition
 */
export const BACKUP_TABLES: BackupTable[] = [
  // Tier 0 — Global (no user FK)
  { name: "Settings", tier: 0 },

  // Tier 1 — Root
  { name: "User", tier: 1 },

  // Tier 2 — Direct User children
  { name: "ExternalApiKey", tier: 2, updatedAtField: "updatedAt" },
  { name: "TrackedWallet", tier: 2, updatedAtField: "updatedAt" },
  { name: "ManualBalance", tier: 2, updatedAtField: "updatedAt" },
  { name: "AddressLabel", tier: 2, updatedAtField: "updatedAt" },
  { name: "PortfolioSetting", tier: 2 },
  { name: "PortfolioSnapshot", tier: 2 },
  { name: "ExchangeBalanceSnapshot", tier: 2 },
  { name: "ChartCache", tier: 2 },
  { name: "ProjectedChartCache", tier: 2 },
  { name: "TransactionCache", tier: 2 },
  { name: "TransactionSyncState", tier: 2, updatedAtField: "updatedAt" },
  { name: "HistorySyncJob", tier: 2, updatedAtField: "updatedAt", resetJobStatus: true },
  { name: "ExchangeTransactionCache", tier: 2, updatedAtField: "updatedAt" },
  { name: "ExchangeSyncState", tier: 2, updatedAtField: "updatedAt" },
  { name: "ManualPrice", tier: 2, updatedAtField: "updatedAt" },
  { name: "CostBasisLot", tier: 2 },
  { name: "RealizedGain", tier: 2 },
  { name: "CapitalFlow", tier: 2 },
  { name: "StakingSnapshot", tier: 2 },
  { name: "StakingPosition", tier: 2, updatedAtField: "updatedAt" },
  { name: "StakingSyncState", tier: 2, updatedAtField: "updatedAt" },
  { name: "FinanceCredential", tier: 2, updatedAtField: "updatedAt" },
  { name: "FinanceInstitution", tier: 2, updatedAtField: "updatedAt" },
  { name: "FinanceBudget", tier: 2, updatedAtField: "updatedAt" },
  { name: "FinanceSubscription", tier: 2, updatedAtField: "updatedAt" },
  { name: "FinanceCategoryRule", tier: 2 },
  { name: "FinanceCustomCategory", tier: 2 },
  { name: "FinanceInvestmentSecurity", tier: 2, updatedAtField: "updatedAt" },
  // SignUpBonusTracker has optional FK to CreditCardProfile (Tier 4)
  { name: "SignUpBonusTracker", tier: 5, updatedAtField: "updatedAt" },
  { name: "PortfolioRefreshJob", tier: 2, updatedAtField: "updatedAt", resetJobStatus: true },
  { name: "FlightSearchResult", tier: 2, updatedAtField: "updatedAt" },
  { name: "PlaidSyncJob", tier: 2, updatedAtField: "updatedAt", resetJobStatus: true },
  { name: "FinanceAlert", tier: 2 },
  { name: "FinanceRecurringStream", tier: 2, updatedAtField: "updatedAt" },
  { name: "FinanceSnapshot", tier: 2 },
  { name: "PlaidDataSnapshot", tier: 2 },

  // Tier 3 — Depends on TrackedWallet or FinanceInstitution
  { name: "BalanceSnapshot", tier: 3 },
  { name: "TrackerTx", tier: 3 },
  { name: "FinanceAccount", tier: 3, updatedAtField: "updatedAt" },

  // Tier 4 — Depends on FinanceAccount
  { name: "FinanceTransaction", tier: 4, updatedAtField: "updatedAt" },
  { name: "FinanceAccountIdentity", tier: 4, updatedAtField: "updatedAt" },
  { name: "FinanceLiabilityCreditCard", tier: 4, updatedAtField: "updatedAt" },
  { name: "FinanceLiabilityMortgage", tier: 4, updatedAtField: "updatedAt" },
  { name: "FinanceLiabilityStudentLoan", tier: 4, updatedAtField: "updatedAt" },
  { name: "FinanceInvestmentHolding", tier: 4, updatedAtField: "updatedAt" },
  { name: "FinanceInvestmentHoldingSnapshot", tier: 4 },
  { name: "FinanceInvestmentTransaction", tier: 4, updatedAtField: "updatedAt" },
  { name: "CreditCardProfile", tier: 4, updatedAtField: "updatedAt" },

  // Tier 5 — Depends on CreditCardProfile or StakingPosition
  { name: "StakingPositionSnapshot", tier: 5 },
  { name: "CreditCardPerk", tier: 5, updatedAtField: "updatedAt" },
  { name: "CreditCardRewardRate", tier: 5, updatedAtField: "updatedAt" },

  // Tier 6 — Depends on CreditCardPerk
  { name: "PerkUsageLog", tier: 6 },
]

/** Models where stuck "running" jobs should be reset to "completed" */
export const JOB_STATUS_TABLES = BACKUP_TABLES
  .filter((t) => t.resetJobStatus)
  .map((t) => t.name)

/** Models that have an @updatedAt field that Prisma auto-sets */
export const TIMESTAMP_TABLES = BACKUP_TABLES
  .filter((t) => t.updatedAtField)
  .map((t) => ({ name: t.name, field: t.updatedAtField! }))

/**
 * Get the Prisma model delegate for a given model name.
 * Uses a plain index lookup — Prisma delegates are lowercase on the client.
 */
export function getModelDelegate(
  db: PrismaClient,
  modelName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const key = modelName.charAt(0).toLowerCase() + modelName.slice(1)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as any)[key]
}
