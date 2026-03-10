import { getCategoryMeta } from "@/lib/finance/categories"

export function WorkshopCategoryPicker({
  categories,
  onAdd,
}: {
  categories: string[]
  onAdd: (category: string) => void
}) {
  return (
    <div className="p-5 border-b border-card-border/50 bg-background-secondary/30">
      <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-3">
        Select a category to add
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {categories.map((cat) => {
          const meta = getCategoryMeta(cat)
          return (
            <button
              key={cat}
              onClick={() => onAdd(cat)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-card border border-card-border hover:border-primary/30 hover:bg-primary-subtle transition-all text-left"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `color-mix(in srgb, ${meta.hex} 10%, var(--background-secondary))` }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 16, color: meta.hex }}>
                  {meta.icon}
                </span>
              </div>
              <span className="text-xs font-medium text-foreground truncate">{cat}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
