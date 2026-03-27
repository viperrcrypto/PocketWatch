"use client"

import { useState } from "react"
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children"
import { BudgetCategoryCard } from "./budget-category-card"
import { sortCategories, type SortMode } from "./budget-helpers"
import { cn } from "@/lib/utils"
import type { BudgetCategoryData } from "./budget-types"
import Link from "next/link"

interface BudgetCategoryListProps {
  categories: BudgetCategoryData[]
  onEditBudget: (id: string, limit: number) => void
  onDeleteBudget: (id: string) => void
  onAddBudget: () => void
}

export function BudgetCategoryList({ categories, onEditBudget, onDeleteBudget, onAddBudget }: BudgetCategoryListProps) {
  const [viewMode, setViewMode] = useState<"this" | "avg">("this")
  const [sortBy, setSortBy] = useState<SortMode>("status")
  const [editingId, setEditingId] = useState<string | null>(null)

  const sorted = sortCategories(categories, sortBy)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-foreground">Budget Categories</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-background-secondary rounded-lg p-0.5">
            <ToggleBtn active={viewMode === "this"} onClick={() => setViewMode("this")}>This Month</ToggleBtn>
            <ToggleBtn active={viewMode === "avg"} onClick={() => setViewMode("avg")}>6mo Avg</ToggleBtn>
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortMode)} className="text-xs bg-background-secondary border-none rounded-lg px-2 py-1 text-foreground-muted focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer">
            <option value="status">By Status</option>
            <option value="amount">By Amount</option>
            <option value="name">By Name</option>
          </select>
        </div>
      </div>

      <StaggerChildren className="space-y-2" staggerMs={40}>
        {sorted.map((budget) => (
          <StaggerItem key={budget.id}>
            <BudgetCategoryCard
              budget={budget}
              isEditing={editingId === budget.id}
              onStartEdit={() => setEditingId(budget.id)}
              onSaveEdit={(id, limit) => { onEditBudget(id, limit); setEditingId(null) }}
              onCancelEdit={() => setEditingId(null)}
              onDelete={onDeleteBudget}
              showSixMonthAvg={viewMode === "avg"}
            />
          </StaggerItem>
        ))}
      </StaggerChildren>

      <div className="flex items-center justify-between pt-1">
        <button onClick={onAddBudget} className="text-xs text-primary font-medium hover:text-primary-hover transition-colors flex items-center gap-1">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add</span>
          Add category budget
        </button>
        <Link href="/finance/budgets/workshop" className="text-xs text-foreground-muted hover:text-foreground transition-colors flex items-center gap-1">
          Edit All <span className="material-symbols-rounded" style={{ fontSize: 12 }}>arrow_forward</span>
        </Link>
      </div>
    </div>
  )
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors", active ? "bg-card text-foreground shadow-sm" : "text-foreground-muted hover:text-foreground")}>
      {children}
    </button>
  )
}
