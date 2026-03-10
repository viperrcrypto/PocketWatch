/**
 * Hooks for merged (built-in + custom) category management.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { financeFetch, financeKeys } from "./shared"

interface MergedCategory {
  id: string | null
  label: string
  icon: string
  hex: string
  isCustom: boolean
}

interface CategoriesResponse {
  categories: MergedCategory[]
}

export function useCategories() {
  return useQuery({
    queryKey: financeKeys.categories(),
    queryFn: () => financeFetch<CategoriesResponse>("/categories"),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { label: string; icon?: string; hex?: string }) =>
      financeFetch<{ id: string; label: string; icon: string; hex: string }>(
        "/categories",
        { method: "POST", body: JSON.stringify(data) }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.categories() }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      financeFetch<{ deleted: boolean }>(`/categories?id=${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.categories() }),
  })
}
