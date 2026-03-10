"use client"

// Barrel re-export — preserves existing import paths
export {
  useUpdates,
  useSeedUpdates,
  useEvents,
  useCampaigns,
  useCampaign,
  useVestingSchedule,
  useDeals,
  useDealCampaigns,
  useDealCampaign,
  useInterestGauges,
  useCommitments,
  useDealContributions,
  useVestingSchedules,
  useMembers,
  useMemberNFTs,
  useRaffles,
  useRaffle,
  useSeedForum,
  useForumCategories,
  useForumThreads,
  useForumThread,
  useForms,
  useFormCommitments,
  useFormSubmissions,
  useLegalTemplates,
  useLegalAgreements,
  useAccreditationRecords,
  useAnalytics,
  useProfile,
  useDashboardStats,
} from "./use-api/queries"

export { usePrefetchDashboardTabs } from "./use-api/prefetch"
