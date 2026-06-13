"use client"

import { motion, useReducedMotion } from "motion/react"
import type { BudgetItem } from "./result-payload"
import { BorderBeam } from "@/components/ui/border-beam"
import { staggerContainer, staggerItem } from "@/lib/motion"

interface BudgetsCardProps {
  budgets: BudgetItem[]
  created: boolean
  updated: boolean
}

const STAGGER_CAP = 8

function usd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function headline(created: boolean, updated: boolean, count: number): string {
  const noun = count === 1 ? "budget" : "budgets"
  if (created) return `Created ${count} ${noun}`
  if (updated) return `Updated ${count} ${noun}`
  return `${count} ${noun}`
}

/**
 * Per-category budget progress rendered from the `budgets` envelope emitted by
 * create_budget / update_budget. Each row shows spent / monthly limit with a
 * progress bar — within budget in warm primary, over budget in the error token.
 * Over-budget rows are spotlit with a BorderBeam.
 *
 * Picasso: staggered row entrance (60ms), reduced-motion drops the stagger and
 * pins the bar widths instantly. All fields are React text nodes — never raw HTML.
 */
export function BudgetsCard({ budgets, created, updated }: BudgetsCardProps) {
  const reduce = useReducedMotion()

  return (
    <div className="my-2">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 16 }}>
          savings
        </span>
        <span className="label-caps">{headline(created, updated, budgets.length)}</span>
      </div>

      <motion.div
        className="space-y-2"
        variants={reduce ? undefined : staggerContainer(60)}
        initial={reduce ? undefined : "hidden"}
        animate={reduce ? undefined : "visible"}
      >
        {budgets.map((b, i) => (
          <BudgetRow
            key={b.id || `${b.category}-${i}`}
            budget={b}
            reduce={Boolean(reduce)}
            staggered={!reduce && i < STAGGER_CAP}
          />
        ))}
      </motion.div>
    </div>
  )
}

function BudgetRow({
  budget,
  reduce,
  staggered,
}: {
  budget: BudgetItem
  reduce: boolean
  staggered: boolean
}) {
  const limit = budget.monthlyLimit
  const ratio = limit > 0 ? budget.spent / limit : 0
  const over = ratio > 1
  const pct = Math.max(0, Math.min(ratio, 1)) * 100
  const accent = over ? "var(--error)" : "var(--primary)"

  return (
    <motion.div
      className="card relative px-3 py-2.5"
      variants={staggered ? staggerItem : undefined}
      initial={staggered ? undefined : false}
      animate={staggered ? undefined : false}
    >
      {over && <BorderBeam radius={16} duration={7} color="var(--error)" />}
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground capitalize truncate">
            {budget.category || "Uncategorized"}
          </span>
          {budget.rollover && (
            <span className="text-[10px] text-foreground-muted bg-background border border-card-border rounded px-1.5 py-0.5">
              rollover
            </span>
          )}
          {!budget.isActive && (
            <span className="text-[10px] text-foreground-muted bg-background border border-card-border rounded px-1.5 py-0.5">
              inactive
            </span>
          )}
          <span
            className="ml-auto text-sm font-bold tabular-nums"
            style={{ color: over ? "var(--error)" : "var(--foreground)" }}
          >
            {usd(budget.spent)}
            <span className="text-[11px] font-normal text-foreground-muted">
              {" "}
              / {usd(limit)}
            </span>
          </span>
        </div>

        <div className="mt-2 h-1.5 rounded-full bg-background overflow-hidden">
          <motion.span
            className="block h-full w-full rounded-full origin-left"
            style={{ backgroundColor: accent }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: pct / 100 }}
            transition={reduce ? { duration: 0 } : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        {over && (
          <p className="mt-1.5 text-[11px] font-medium" style={{ color: "var(--error)" }}>
            {usd(budget.spent - limit)} over budget
          </p>
        )}
      </div>
    </motion.div>
  )
}
