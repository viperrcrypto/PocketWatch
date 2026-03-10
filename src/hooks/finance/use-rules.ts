/**
 * Category rule CRUD hooks.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { financeFetch, financeKeys } from "./shared"

// ─── Types ──────────────────────────────────────────────────────

interface CategoryRule {
  id: string
  matchType: string
  matchValue: string
  category: string
  subcategory: string | null
  priority: number
}

// ─── Category Rules Hooks ───────────────────────────────────────

export function useCategoryRules() {
  return useQuery({
    queryKey: financeKeys.categoryRules(),
    queryFn: () => financeFetch<CategoryRule[]>("/category-rules"),
  })
}

export function useCreateCategoryRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      matchType: string
      matchValue: string
      category: string
      subcategory?: string
      priority?: number
    }) => financeFetch("/category-rules", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.categoryRules() }),
  })
}

export function useDeleteCategoryRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ruleId: string) =>
      financeFetch(`/category-rules?ruleId=${ruleId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.categoryRules() }),
  })
}
