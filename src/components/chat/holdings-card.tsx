"use client"

import { useMemo } from "react"
import { motion, useReducedMotion } from "motion/react"
import type { HoldingItem } from "./result-payload"
import { BorderBeam } from "@/components/ui/border-beam"
import { staggerContainer, staggerItem } from "@/lib/motion"

interface HoldingsCardProps {
  holdings: HoldingItem[]
  totalValue: number
  onchainTotalValue: number
  exchangeTotalValue: number
  shown: number
  totalPositions: number
}

const STAGGER_CAP = 8

function usd(value: number): string {
  const abs = Math.abs(value)
  const digits = abs >= 1000 || abs === 0 ? 0 : 2
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function qty(value: number): string {
  if (value === 0) return "0"
  const abs = Math.abs(value)
  const digits = abs >= 1000 ? 0 : abs >= 1 ? 2 : 6
  return value.toLocaleString("en-US", { maximumFractionDigits: digits })
}

/**
 * Compact holdings table rendered from the `get_portfolio_balances` envelope.
 * Each row: token (symbol + name), chain/protocol, quantity, USD value, plus a
 * subtle warm value bar scaled to the largest holding. The top holding is
 * spotlit with a BorderBeam.
 *
 * Picasso: staggered row entrance (60ms via staggerContainer), warm layered
 * depth, no purple. All fields are React text nodes — never raw HTML. Reduced
 * motion drops the stagger entirely.
 */
export function HoldingsCard({
  holdings,
  totalValue,
  onchainTotalValue,
  exchangeTotalValue,
  shown,
  totalPositions,
}: HoldingsCardProps) {
  const reduce = useReducedMotion()
  const maxValue = useMemo(
    () => holdings.reduce((m, h) => Math.max(m, h.value), 0),
    [holdings]
  )
  const topIndex = useMemo(() => {
    let best = 0
    for (let i = 1; i < holdings.length; i++) {
      if (holdings[i]!.value > holdings[best]!.value) best = i
    }
    return best
  }, [holdings])

  const hasSplit = onchainTotalValue > 0 && exchangeTotalValue > 0

  return (
    <div className="my-2">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 16 }}>
          account_balance_wallet
        </span>
        <span className="label-caps">Portfolio holdings</span>
        <span className="ml-auto text-sm font-bold text-foreground tabular-nums">
          {usd(totalValue)}
        </span>
      </div>

      {hasSplit && (
        <div className="flex flex-wrap gap-2 mb-2 text-[11px] text-foreground-muted">
          <span className="bg-background border border-card-border rounded px-1.5 py-0.5">
            On-chain {usd(onchainTotalValue)}
          </span>
          <span className="bg-background border border-card-border rounded px-1.5 py-0.5">
            Exchange {usd(exchangeTotalValue)}
          </span>
        </div>
      )}

      <motion.div
        className="card overflow-hidden divide-y divide-card-border"
        variants={reduce ? undefined : staggerContainer(60)}
        initial={reduce ? undefined : "hidden"}
        animate={reduce ? undefined : "visible"}
      >
        {holdings.map((h, i) => (
          <HoldingRow
            key={`${h.symbol}-${h.chain}-${i}`}
            holding={h}
            maxValue={maxValue}
            isTop={i === topIndex}
            staggered={!reduce && i < STAGGER_CAP}
          />
        ))}
      </motion.div>

      {totalPositions > shown && (
        <p className="mt-2 text-[11px] text-foreground-muted">
          Showing top {shown} of {totalPositions} positions
        </p>
      )}
    </div>
  )
}

function HoldingRow({
  holding,
  maxValue,
  isTop,
  staggered,
}: {
  holding: HoldingItem
  maxValue: number
  isTop: boolean
  staggered: boolean
}) {
  const pct = maxValue > 0 ? Math.max(2, (holding.value / maxValue) * 100) : 0
  const meta = [holding.chain, holding.protocol]
    .filter((x): x is string => Boolean(x))
    .join(" · ")

  return (
    <motion.div
      className="relative px-3 py-2"
      variants={staggered ? staggerItem : undefined}
      initial={staggered ? undefined : false}
      animate={staggered ? undefined : false}
    >
      {isTop && <BorderBeam radius={0} duration={7} />}
      <div className="relative flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-foreground truncate">{holding.symbol}</span>
            {holding.name && holding.name !== holding.symbol && (
              <span className="text-[11px] text-foreground-muted truncate">{holding.name}</span>
            )}
          </div>
          {meta && <p className="text-[10px] text-foreground-muted truncate mt-0.5">{meta}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground tabular-nums">{usd(holding.value)}</p>
          <p className="text-[10px] text-foreground-muted tabular-nums">
            {qty(holding.quantity)} {holding.symbol}
          </p>
        </div>
      </div>
      {/* Subtle warm value bar — share of the largest holding */}
      <div className="relative mt-1.5 h-1 rounded-full bg-background overflow-hidden">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-primary/35"
          style={{ width: `${pct}%` }}
        />
      </div>
    </motion.div>
  )
}
