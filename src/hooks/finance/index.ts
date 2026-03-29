/**
 * Barrel re-export for all Finance React Query hooks.
 * Import from this file or from the individual domain files.
 */

export { financeFetch, financeKeys } from "./shared"
export type { TxFilters } from "./shared"

export {
  useFinanceAccounts,
  useUpdateAccount,
  useDisconnectInstitution,
  useDeleteAccount,
  useAccountSpending,
  useAccountIdentity,
  useCreateLinkToken,
  useExchangePlaidToken,
  useCreateReconnectToken,
  useCompleteReconnect,
  usePlaidSyncStatus,
  useResyncPlaidData,
  useConnectSimpleFIN,
  useSyncInstitution,
  useSyncAll,
  useFetchFullHistory,
} from "./use-accounts"

export {
  useFinanceTransactions,
  useUpdateTransaction,
  useUpdateTransactionCategory,
  useBulkCategorize,
  useAutoCategorize,
  useUncategorizedTransactions,
  useAICategorize,
  useApplyAISuggestions,
  useAIAudit,
  useApplyAIAudit,
} from "./use-transactions"

export {
  useFinanceBudgets,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  useBudgetSuggestions,
  useBudgetAI,
  useGenerateBudgetAI,
} from "./use-budgets"

export type { SubscriptionItem } from "./use-subscriptions"
export {
  useFinanceSubscriptions,
  useUpdateSubscription,
  useDetectSubscriptions,
  useCancelGuidance,
  useRecurringStreams,
} from "./use-subscriptions"

export {
  useCreditCards,
  useSaveCreditCard,
  useCardRecommendations,
  useCardStrategy,
  useCardPerks,
  useSaveCardPerk,
  useToggleCardPerk,
  useCardRewardRates,
  useSaveCardRewardRate,
  useCardAIEnrich,
  useCardAsk,
  useAutoIdentifyCards,
} from "./use-credit-cards"

export {
  useAutoEnrichCards,
  useApplyEnrichment,
  useCheckPerkUsage,
  useAllCardPerks,
  type EnrichProgress,
} from "./use-card-enrichment"

export {
  useFinanceInsights,
  useFinanceDeepInsights,
  useNetWorth,
  useFinanceTrends,
  useUpcomingBills,
  useAIInsights,
  useGenerateAIInsights,
  useSpendingByMonth,
} from "./use-insights"

export type { AIInsightsData } from "./use-insights"

export {
  useCategoryRules,
  useCreateCategoryRule,
  useDeleteCategoryRule,
} from "./use-rules"

export {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
} from "./use-categories"

export type { FinanceSettingsService, FinanceCredentialVerificationResponse } from "./use-settings"
export {
  useFinanceSettings,
  useSaveFinanceCredential,
  useVerifyFinanceCredential,
  useDeleteFinanceCredential,
  useFinanceIncome,
  useSetIncomeOverride,
  useAISettings,
  useSaveAIProvider,
  useDeleteAIProvider,
} from "./use-settings"

export {
  useInvestments,
  useCreateInvestment,
  useUpdateInvestment,
  useDeleteInvestment,
  useInvestmentHistory,
  useInvestmentHoldings,
  useInvestmentTransactions,
  useLiabilities,
} from "./use-investments"

export {
  useAccountCoverage,
  useUploadStatement,
  useManualAccounts,
  useCreateManualAccount,
  useDeleteManualAccount,
} from "./use-statements"

export type { ReviewTransaction } from "./use-review"
export {
  useReviewCount,
  useReviewQueue,
  useConfirmReview,
} from "./use-review"

export type { ProcessedMerchant, RebuildSummary } from "./use-ai-rebuild"
export {
  useAIRebuild,
} from "./use-ai-rebuild"
