import { cn } from "@/lib/utils"

interface AmountDisplayProps {
  amount: number
  currency?: string
  className?: string
  showSign?: boolean
}

export function AmountDisplay({ amount, currency = "USD", className, showSign = true }: AmountDisplayProps) {
  const isOutflow = amount > 0
  const absAmount = Math.abs(amount)

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absAmount)

  const prefix = showSign ? (isOutflow ? "-" : "+") : ""

  return (
    <span
      className={cn(
        "font-data font-medium",
        isOutflow ? "text-error" : "text-success",
        className
      )}
    >
      {prefix}{formatted}
    </span>
  )
}
