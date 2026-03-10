"use client"

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { portfolioFetch, portfolioKeys } from "./shared"

// ─── Analytics query keys ───

const analyticsKeys = {
  all: [...portfolioKeys.all, "analytics"] as const,
  summary: (wallets?: string[], assets?: string[], period?: string, taxYear?: string) =>
    [...portfolioKeys.all, "analytics", "summary", wallets, assets, period, taxYear] as const,
  compute: () => [...portfolioKeys.all, "analytics", "compute"] as const,
  lots: (wallets?: string[], assets?: string[]) =>
    [...portfolioKeys.all, "analytics", "lots", wallets, assets] as const,
  gains: (wallets?: string[], assets?: string[], from?: string, to?: string, taxYear?: string) =>
    [...portfolioKeys.all, "analytics", "gains", wallets, assets, from, to, taxYear] as const,
  harvesting: () => [...portfolioKeys.all, "analytics", "harvesting"] as const,
}

// ─── 11a1. Analytics Summary ───

export function useAnalyticsSummary(
  wallets?: string[],
  assets?: string[],
  period?: string,
  taxYear?: string,
) {
  const params = new URLSearchParams()
  if (wallets) wallets.forEach((w) => params.append("wallets[]", w))
  if (assets) assets.forEach((a) => params.append("assets[]", a))
  if (taxYear) params.set("taxYear", taxYear)
  else if (period) params.set("period", period)
  const qs = params.toString()

  return useQuery({
    queryKey: analyticsKeys.summary(wallets, assets, period, taxYear),
    queryFn: () => portfolioFetch<any>(`/analytics/summary${qs ? `?${qs}` : ""}`),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  })
}

// ─── 11a2. Compute Cost Basis (mutation) ───

export function useComputeCostBasis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => portfolioFetch<any>("/analytics/compute", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: analyticsKeys.all })
    },
  })
}

// ─── 11a3. Cost Basis Lots ───

export function useCostBasisLots(wallets?: string[], assets?: string[]) {
  const params = new URLSearchParams()
  if (wallets) wallets.forEach((w) => params.append("wallets[]", w))
  if (assets) assets.forEach((a) => params.append("assets[]", a))
  const qs = params.toString()

  return useQuery({
    queryKey: analyticsKeys.lots(wallets, assets),
    queryFn: () => portfolioFetch<any>(`/analytics/lots${qs ? `?${qs}` : ""}`),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  })
}

// ─── 11a4. Realized Gains ───

export function useRealizedGains(
  wallets?: string[],
  assets?: string[],
  dateRange?: { from?: string; to?: string },
  taxYear?: string,
) {
  const params = new URLSearchParams()
  if (wallets) wallets.forEach((w) => params.append("wallets[]", w))
  if (assets) assets.forEach((a) => params.append("assets[]", a))
  if (taxYear) {
    params.set("taxYear", taxYear)
  } else {
    if (dateRange?.from) params.set("from", dateRange.from)
    if (dateRange?.to) params.set("to", dateRange.to)
  }
  const qs = params.toString()

  return useQuery({
    queryKey: analyticsKeys.gains(wallets, assets, dateRange?.from, dateRange?.to, taxYear),
    queryFn: () => portfolioFetch<any>(`/analytics/gains${qs ? `?${qs}` : ""}`),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  })
}

// ─── 11a4b. Tax-Loss Harvesting ───

export function useTaxHarvesting() {
  return useQuery({
    queryKey: analyticsKeys.harvesting(),
    queryFn: () => portfolioFetch<any>("/analytics/harvesting"),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  })
}

// ─── 11a4c. Export Tax Report ───

export function useExportTaxReport() {
  return useMutation({
    mutationFn: async ({ format, taxYear, wallets, assets }: {
      format: string; taxYear: string; wallets?: string[]; assets?: string[]
    }) => {
      const params = new URLSearchParams()
      params.set("format", format)
      params.set("taxYear", taxYear)
      if (wallets) wallets.forEach((w) => params.append("wallets[]", w))
      if (assets) assets.forEach((a) => params.append("assets[]", a))

      const res = await fetch(
        `/api/portfolio/analytics/export?${params}`,
        { credentials: "include" },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed" }))
        throw new Error(err.error || `Export failed: ${res.status}`)
      }

      const contentType = res.headers.get("Content-Type") ?? ""
      if (contentType.includes("application/json")) {
        // schedule_d returns JSON — convert to CSV and download
        const { generateScheduleDCsv } = await import("@/lib/portfolio/tax-export")
        const data = await res.json()
        const csv = generateScheduleDCsv(data, taxYear)
        const blob = new Blob([csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `schedule-d-${taxYear}.csv`
        a.click()
        URL.revokeObjectURL(url)
        return { type: "csv" as const, filename: `schedule-d-${taxYear}.csv` }
      }

      // CSV formats — trigger blob download
      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const filenameMatch = disposition.match(/filename="([^"]+)"/)
      const filename = filenameMatch?.[1] ?? `tax-export-${taxYear}.csv`

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)

      return { type: "csv" as const, filename }
    },
  })
}
