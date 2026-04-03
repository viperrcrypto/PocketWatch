"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { FINANCE_CATEGORIES, type CategoryMeta } from "@/lib/finance/categories"
import { useCategories, useCreateCategory } from "@/hooks/finance/use-categories"
import { toast } from "sonner"

const NEW_CATEGORY_COLORS = [
  "#6366f1", "#ef4444", "#f59e0b", "#06b6d4",
  "#10b981", "#a855f7", "#ec4899", "#64748b",
]

interface CategoryPickerProps {
  selected: string | null
  onSelect: (category: string, subcategory: string | null) => void
}

export function CategoryPicker({ selected, onSelect }: CategoryPickerProps) {
  const [search, setSearch] = useState("")
  const [showNewForm, setShowNewForm] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newColor, setNewColor] = useState(NEW_CATEGORY_COLORS[0])

  const { data: categoriesData } = useCategories()
  const createCategory = useCreateCategory()

  // Build merged category list
  const allCategories = useMemo(() => {
    const builtIn = Object.entries(FINANCE_CATEGORIES).map(([key, meta]) => ({
      key,
      icon: meta.icon,
      hex: meta.hex,
      isCustom: false,
    }))

    const custom = (categoriesData?.categories ?? [])
      .filter((c) => c.isCustom)
      .map((c) => ({ key: c.label, icon: c.icon, hex: c.hex, isCustom: true }))

    return [...builtIn, ...custom]
  }, [categoriesData])

  const filtered = useMemo(() => {
    if (!search.trim()) return allCategories
    const q = search.toLowerCase()
    return allCategories.filter((c) => c.key.toLowerCase().includes(q))
  }, [allCategories, search])

  const handleCreate = () => {
    const label = newLabel.trim()
    if (!label) return
    createCategory.mutate(
      { label, hex: newColor },
      {
        onSuccess: () => {
          toast.success(`Created "${label}"`)
          setNewLabel("")
          setShowNewForm(false)
          onSelect(label, null)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  return (
    <div className="bg-card border border-card-border rounded-xl p-3 space-y-2">
      {/* Search input */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter categories..."
        className="w-full px-3 py-2.5 text-sm rounded-lg bg-background-secondary border border-card-border text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-primary transition-colors"
      />

      {/* Category grid */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5">
        {filtered.map((cat) => (
          <button
            key={cat.key}
            onClick={() => onSelect(cat.key, null)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left",
              selected === cat.key
                ? "bg-foreground text-background"
                : "hover:bg-background-secondary text-foreground-muted hover:text-foreground"
            )}
          >
            <span
              className="material-symbols-rounded flex-shrink-0"
              style={{ fontSize: 14, color: selected === cat.key ? "currentColor" : cat.hex }}
            >
              {cat.icon}
            </span>
            <span className="truncate">{cat.key}</span>
            {selected === cat.key && (
              <span className="material-symbols-rounded ml-auto flex-shrink-0" style={{ fontSize: 14 }}>check</span>
            )}
            {cat.isCustom && selected !== cat.key && (
              <span className="ml-auto text-[9px] text-foreground-muted/50">custom</span>
            )}
          </button>
        ))}
      </div>

      {/* New category form */}
      {showNewForm ? (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Category name"
            className="flex-1 px-3 py-2 text-xs rounded-lg bg-background-secondary border-0 text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:ring-1 focus:ring-foreground/20"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <div className="flex gap-1">
            {NEW_CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={cn(
                  "w-5 h-5 rounded-full transition-colors",
                  newColor === c ? "ring-2 ring-foreground ring-offset-1 ring-offset-card" : ""
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            onClick={handleCreate}
            disabled={!newLabel.trim() || createCategory.isPending}
            className="px-3 py-2 text-xs font-medium bg-foreground text-background rounded-lg hover:opacity-90 disabled:opacity-40"
          >
            Add
          </button>
          <button
            onClick={() => { setShowNewForm(false); setNewLabel("") }}
            className="px-2 py-2 text-xs text-foreground-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors pt-1"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add</span>
          New Category
        </button>
      )}
    </div>
  )
}
