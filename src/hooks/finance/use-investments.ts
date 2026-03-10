/**
 * Investment holdings, history, transactions, liabilities, and CRUD hooks.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { financeFetch, financeKeys } from "./shared"

// ─── Types ──────────────────────────────────────────────────────

interface InvestmentAccount {
  id: string
  name: string
  officialName: string | null
  type: string
  subtype: string | null
  currentBalance: number | null
  currency: string
  isHidden: boolean
  updatedAt: string
}

interface InvestmentInstitution {
  id: string
  provider: string
  institutionName: string
  institutionLogo: string | null
  lastSyncedAt: string | null
  accounts: InvestmentAccount[]
}

interface InvestmentsData {
  institutions: InvestmentInstitution[]
  totalValue: number
}

interface InvestmentHistoryEntry {
  date: string
  totalValue: number
  totalCostBasis: number
  gainLoss: number
}

interface InvestmentHistoryData {
  entries: InvestmentHistoryEntry[]
  source: "holdings_snapshots" | "none"
}

// ─── Investment Hooks ───────────────────────────────────────────

export function useInvestments() {
  return useQuery({
    queryKey: financeKeys.investments(),
    queryFn: () => financeFetch<InvestmentsData>("/investments"),
  })
}

export function useCreateInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; value: number; type?: string }) =>
      financeFetch("/investments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.investments() })
      qc.invalidateQueries({ queryKey: financeKeys.accounts() })
    },
  })
}

export function useUpdateInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { accountId: string; name?: string; value?: number }) =>
      financeFetch("/investments", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.investments() })
      qc.invalidateQueries({ queryKey: financeKeys.accounts() })
    },
  })
}

export function useDeleteInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (accountId: string) =>
      financeFetch(`/investments?accountId=${accountId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.investments() })
      qc.invalidateQueries({ queryKey: financeKeys.accounts() })
    },
  })
}

// ─── Investment History Hook ─────────────────────────────────────

export function useInvestmentHistory(range = "1y") {
  return useQuery({
    queryKey: financeKeys.investmentHistory(range),
    queryFn: () => financeFetch<InvestmentHistoryData>(`/investments/history?range=${range}`),
  })
}

// ─── Investment Holdings Hook ────────────────────────────────────

export function useInvestmentHoldings() {
  return useQuery({
    queryKey: financeKeys.investmentHoldings(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => financeFetch<{
      holdings: Array<any>
      securities: Array<any>
      totalValue: number
    }>("/investments/holdings"),
  })
}

// ─── Investment Transactions Hook ────────────────────────────────

export function useInvestmentTransactions(filters: { page?: number; limit?: number; type?: string } = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v))
  }
  return useQuery({
    queryKey: financeKeys.investmentTransactions(filters),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => financeFetch<{
      transactions: Array<any>
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>(`/investments/transactions?${params.toString()}`),
  })
}

// ─── Liabilities Hook ────────────────────────────────────────────

export function useLiabilities() {
  return useQuery({
    queryKey: financeKeys.liabilities(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => financeFetch<{
      creditCards: Array<any>
      mortgages: Array<any>
      studentLoans: Array<any>
    }>("/liabilities"),
  })
}
