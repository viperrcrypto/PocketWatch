"use client"

import { cn } from "@/lib/utils"

interface PortfolioAmountDisplayProps {
  amount: string | number
  currency?: string
  showSign?: boolean
  decimals?: number
  className?: string
}

function formatAmount(value: number, decimals: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value))
}

export function PortfolioAmountDisplay({
  amount,
  currency,
  showSign,
  decimals = 2,
  className,
}: PortfolioAmountDisplayProps) {
  const numericValue = typeof amount === "string" ? parseFloat(amount) : amount
  const isPositive = numericValue >= 0
  const isNegative = numericValue < 0

  const formatted = formatAmount(numericValue, decimals)

  let sign = ""
  if (showSign) {
    sign = isPositive ? "+" : "-"
  } else if (isNegative) {
    sign = "-"
  }

  const colorClass = showSign
    ? isPositive
      ? "text-success"
      : "text-error"
    : undefined

  return (
    <span
      className={cn(
        "font-data tabular-nums",
        colorClass,
        className
      )}
    >
      {sign}
      {currency && <span>{currency}</span>}
      {formatted}
    </span>
  )
}
