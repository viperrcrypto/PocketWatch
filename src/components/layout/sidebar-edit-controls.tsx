"use client"

import { cn } from "@/lib/utils"
import {
  type SidebarPrefs,
  NAV_CATEGORIES,
  getAllItemsOrdered,
} from "@/hooks/use-sidebar-prefs"

interface SidebarEditControlsProps {
  prefs: SidebarPrefs
  moveItem: (cat: string, id: string, dir: "up" | "down") => void
  toggleVisibility: (cat: string, id: string) => void
  moveCategory: (cat: string, dir: "up" | "down") => void
  resetToDefaults: () => void
  onDone: () => void
}

export function SidebarEditControls({
  prefs,
  moveItem,
  toggleVisibility,
  moveCategory,
  resetToDefaults,
  onDone,
}: SidebarEditControlsProps) {
  return (
    <div className="flex-1 py-3 px-3 overflow-y-auto space-y-4">
      {prefs.categoryOrder.map((catKey, catIdx) => {
        const category = NAV_CATEGORIES[catKey]
        if (!category) return null
        const items = getAllItemsOrdered(catKey, prefs)
        const hiddenSet = new Set(prefs.categories[catKey]?.hidden ?? [])
        const isFirst = catIdx === 0
        const isLast = catIdx === prefs.categoryOrder.length - 1

        return (
          <div key={catKey}>
            {/* Category header with reorder arrows */}
            <div className="flex items-center gap-1 px-2 mb-2">
              <p className="text-[10px] font-semibold tracking-widest text-foreground-muted uppercase flex-1">
                {category.label}
              </p>
              <button
                onClick={() => moveCategory(catKey, "up")}
                disabled={isFirst}
                className="p-0.5 rounded text-foreground-muted hover:text-foreground disabled:opacity-20 disabled:hover:text-foreground-muted transition-colors"
                aria-label={`Move ${category.label} up`}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>keyboard_arrow_up</span>
              </button>
              <button
                onClick={() => moveCategory(catKey, "down")}
                disabled={isLast}
                className="p-0.5 rounded text-foreground-muted hover:text-foreground disabled:opacity-20 disabled:hover:text-foreground-muted transition-colors"
                aria-label={`Move ${category.label} down`}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>keyboard_arrow_down</span>
              </button>
            </div>

            {/* Items */}
            <div className="space-y-0.5">
              {items.map((item, idx) => {
                const isHidden = hiddenSet.has(item.id)
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm",
                      isHidden ? "opacity-40" : ""
                    )}
                  >
                    <span
                      className="material-symbols-rounded text-foreground-muted"
                      style={{ fontSize: 16 }}
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1 text-foreground-muted text-xs font-medium truncate">
                      {item.label}
                    </span>

                    {/* Visibility toggle */}
                    <button
                      onClick={() => toggleVisibility(catKey, item.id)}
                      className="p-0.5 rounded text-foreground-muted hover:text-foreground transition-colors"
                      aria-label={isHidden ? `Show ${item.label}` : `Hide ${item.label}`}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 15 }}>
                        {isHidden ? "visibility_off" : "visibility"}
                      </span>
                    </button>

                    {/* Reorder arrows */}
                    <button
                      onClick={() => moveItem(catKey, item.id, "up")}
                      disabled={idx === 0}
                      className="p-0.5 rounded text-foreground-muted hover:text-foreground disabled:opacity-20 transition-colors"
                      aria-label={`Move ${item.label} up`}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 14 }}>keyboard_arrow_up</span>
                    </button>
                    <button
                      onClick={() => moveItem(catKey, item.id, "down")}
                      disabled={idx === items.length - 1}
                      className="p-0.5 rounded text-foreground-muted hover:text-foreground disabled:opacity-20 transition-colors"
                      aria-label={`Move ${item.label} down`}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 14 }}>keyboard_arrow_down</span>
                    </button>
                  </div>
                )
              })}
            </div>

            {catIdx < prefs.categoryOrder.length - 1 && (
              <hr className="border-card-border my-3 mx-2" />
            )}
          </div>
        )
      })}

      {/* Actions */}
      <div className="flex items-center gap-2 px-2 pt-2">
        <button
          onClick={onDone}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary-hover transition-colors"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>check</span>
          Done
        </button>
        <button
          onClick={resetToDefaults}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>restart_alt</span>
          Reset
        </button>
      </div>
    </div>
  )
}
