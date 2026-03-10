"use client"

import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { fetchJSON } from "@/lib/fetch-json"

// ─── Updates (Discord webhook) ───
export function useUpdates(category?: string | null, page = 1, limit = 20) {
  return useQuery({
    queryKey: ["updates", category ?? "all", page, limit],
    queryFn: () => {
      const params = new URLSearchParams()
      if (category) params.set("category", category)
      params.set("page", String(page))
      params.set("limit", String(limit))
      const qs = params.toString()
      return fetchJSON<{ updates: any[]; totalCount: number; page: number; totalPages: number }>(`/api/discord/webhook${qs ? `?${qs}` : ""}`)
    },
    placeholderData: keepPreviousData,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useSeedUpdates() {
  return useQuery({
    queryKey: ["updates-seed"],
    queryFn: () => fetchJSON<{ updates: any[] }>("/api/discord/webhook?seed=true"),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}

// ─── Events ───
export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => fetchJSON<{ events: any[] }>("/api/events"),
    select: (data) => data.events || [],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

// ─── Campaigns ───
export function useCampaigns(status?: string | null) {
  return useQuery({
    queryKey: ["campaigns", status ?? "all"],
    queryFn: () => {
      const url = status ? `/api/campaigns?status=${status}` : "/api/campaigns"
      return fetchJSON<{ campaigns: any[] }>(url)
    },
    select: (data) => data.campaigns || [],
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ["campaign", id],
    queryFn: () => fetchJSON<any>(`/api/campaigns/${id}`),
    enabled: !!id,
    staleTime: 30 * 1000,
  })
}

// ─── Vesting ───
export function useVestingSchedule(campaignId: string) {
  return useQuery({
    queryKey: ["vesting", campaignId],
    queryFn: () => fetchJSON<{ schedule: any }>(`/api/campaigns/${campaignId}/vesting`),
    enabled: !!campaignId,
    staleTime: 30 * 1000,
    retry: false,
  })
}

// ─── Deals ───
export function useDeals(status?: string | null) {
  return useQuery({
    queryKey: ["deals", status ?? "all"],
    queryFn: () => {
      const url = status ? `/api/deals?status=${status}` : "/api/deals"
      return fetchJSON<{ deals: any[] }>(url)
    },
    select: (data) => data.deals || [],
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

// ─── Deal Campaigns ───
export function useDealCampaigns(filter?: { status?: string; phase?: string; includeArchived?: boolean }) {
  return useQuery({
    queryKey: ["deal-campaigns", filter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filter?.status) params.set("status", filter.status)
      if (filter?.phase) params.set("phase", filter.phase)
      params.set("includeArchived", filter?.includeArchived ? "true" : "false")
      const qs = params.toString()
      return fetchJSON<{ campaigns: any[] }>(`/api/deals/campaigns${qs ? `?${qs}` : ""}`)
    },
    select: (data) => data.campaigns || [],
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  })
}

export function useDealCampaign(id: string) {
  return useQuery({
    queryKey: ["deal-campaign", id],
    queryFn: () => fetchJSON<any>(`/api/deals/campaigns/${id}`),
    enabled: !!id,
    staleTime: 30 * 1000,
  })
}

export function useInterestGauges(campaignId: string) {
  return useQuery({
    queryKey: ["interest-gauges", campaignId],
    queryFn: () => fetchJSON<{ gauges: any[] }>(`/api/deals/campaigns/${campaignId}/interest-gauges`),
    enabled: !!campaignId,
    staleTime: 30 * 1000,
  })
}

export function useCommitments(campaignId: string) {
  return useQuery({
    queryKey: ["commitments", campaignId],
    queryFn: () => fetchJSON<{ commitments: any[] }>(`/api/deals/campaigns/${campaignId}/commitments`),
    enabled: !!campaignId,
    staleTime: 30 * 1000,
  })
}

export function useDealContributions(campaignId: string) {
  return useQuery({
    queryKey: ["deal-contributions", campaignId],
    queryFn: () => fetchJSON<{ contributions: any[] }>(`/api/deals/campaigns/${campaignId}/contributions`),
    enabled: !!campaignId,
    staleTime: 30 * 1000,
  })
}

// ─── Vesting Schedules ───
export function useVestingSchedules(campaignId?: string) {
  return useQuery({
    queryKey: ["vesting-schedules", campaignId ?? "all"],
    queryFn: () => {
      const url = campaignId
        ? `/api/vesting/schedules?campaignId=${campaignId}`
        : "/api/vesting/schedules"
      return fetchJSON<{ schedules: any[] }>(url)
    },
    select: (data) => data.schedules || [],
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })
}

// ─── Members ───
export function useMembers(search?: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: ["members", search ?? "", page, limit],
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      params.set("page", String(page))
      params.set("limit", String(limit))
      return fetchJSON<{ members: any[]; totalCount: number; page: number; totalPages: number; limit: number }>(`/api/members?${params}`)
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })
}

export function useMemberNFTs(memberId: string | null) {
  return useQuery({
    queryKey: ["member-nfts", memberId],
    queryFn: () =>
      fetchJSON<{ nfts: any[]; walletAddress: string; count: number }>(
        `/api/members/${memberId}/nfts`
      ),
    enabled: !!memberId,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Raffles ───
export function useRaffles(filter?: "all" | "active" | "ended" | "scheduled") {
  return useQuery({
    queryKey: ["raffles", filter ?? "all"],
    queryFn: () => {
      const url = !filter || filter === "all" ? "/api/raffles" : `/api/raffles?status=${filter}`
      return fetchJSON<{ raffles: any[] }>(url)
    },
    select: (data) => data.raffles || [],
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useRaffle(id: string) {
  return useQuery({
    queryKey: ["raffle", id],
    queryFn: () => fetchJSON<any>(`/api/raffles/${id}`),
    enabled: !!id,
    refetchInterval: 30_000,
    staleTime: 15 * 1000,
  })
}

// ─── Forum ───
export function useSeedForum() {
  return useQuery({
    queryKey: ["forum-seed"],
    queryFn: () => fetchJSON<any>("/api/forum/seed"),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}

export function useForumCategories() {
  return useQuery({
    queryKey: ["forum-categories"],
    queryFn: () => fetchJSON<{ categories: any[] }>("/api/forum"),
    select: (data) => data.categories || [],
    staleTime: 10 * 60 * 1000,
  })
}

export function useForumThreads(category?: string) {
  return useQuery({
    queryKey: ["forum-threads", category ?? "all"],
    queryFn: () => {
      const url = category ? `/api/forum/threads?category=${category}` : "/api/forum/threads"
      return fetchJSON<{ threads: any[] }>(url)
    },
    select: (data) => data.threads || [],
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })
}

export function useForumThread(id: string) {
  return useQuery({
    queryKey: ["forum-thread", id],
    queryFn: () => fetchJSON<any>(`/api/forum/threads/${id}`),
    enabled: !!id,
    staleTime: 30 * 1000,
  })
}

// ─── Forms ───
export function useForms() {
  return useQuery({
    queryKey: ["forms"],
    queryFn: () => fetchJSON<{ forms: any[] }>("/api/forms"),
    select: (data) => data.forms || [],
    staleTime: 2 * 60 * 1000,
  })
}

export function useFormCommitments() {
  return useQuery({
    queryKey: ["form-commitments"],
    queryFn: () =>
      fetchJSON<{
        positions: Array<{
          dealId: string
          dealTitle: string
          interestedAmount: string
          commitmentAmount: string
          committed: boolean
          txLink: string
          wallet: string
          stage: string
        }>
      }>("/api/forms/commitments"),
    select: (data) => data.positions || [],
    staleTime: 60_000,
  })
}

export function useFormSubmissions() {
  return useQuery({
    queryKey: ["form-submissions"],
    queryFn: () =>
      fetchJSON<{
        submissions: Record<
          string,
          { submitted: boolean; lastSubmittedTime: string | null }
        >
      }>("/api/forms/submissions"),
    select: (data) => data.submissions || {},
    staleTime: 30_000,
  })
}

// ─── Legal ───
export function useLegalTemplates(status?: string | null) {
  return useQuery({
    queryKey: ["legal-templates", status ?? "all"],
    queryFn: () => {
      const url = status ? `/api/admin/legal/templates?status=${status}` : "/api/admin/legal/templates"
      return fetchJSON<{ templates: any[] }>(url)
    },
    select: (data) => data.templates || [],
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useLegalAgreements(filter?: { status?: string; instrumentType?: string }) {
  return useQuery({
    queryKey: ["legal-agreements", filter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filter?.status) params.set("status", filter.status)
      if (filter?.instrumentType) params.set("instrumentType", filter.instrumentType)
      const qs = params.toString()
      return fetchJSON<{ agreements: any[] }>(`/api/admin/legal/agreements${qs ? `?${qs}` : ""}`)
    },
    select: (data) => data.agreements || [],
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useAccreditationRecords(status?: string | null) {
  return useQuery({
    queryKey: ["accreditation-records", status ?? "all"],
    queryFn: () => {
      const url = status ? `/api/admin/legal/accreditation?status=${status}` : "/api/admin/legal/accreditation"
      return fetchJSON<{ records: any[] }>(url)
    },
    select: (data) => data.records || [],
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

// ─── Analytics & Profile ───
export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: () => fetchJSON<any>("/api/analytics"),
    staleTime: 5 * 60 * 1000,
  })
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchJSON<any>("/api/auth/me"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

// ─── Dashboard stats ───
interface DashboardStats {
  memberCount: number
  activeDealsCount: number
  recentUpdates: any[]
  upcomingEvents: any[]
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetchJSON<DashboardStats>("/api/dashboard/stats"),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
