import { formatCurrency, cn } from "@/lib/utils"

// ─── Type Metadata ──────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: string; label: string; bgClass: string; textClass: string }> = {
  buy: {
    icon: "add_circle",
    label: "Buy",
    bgClass: "bg-green-100 dark:bg-green-500/10",
    textClass: "text-green-700 dark:text-green-400",
  },
  sell: {
    icon: "remove_circle",
    label: "Sell",
    bgClass: "bg-red-100 dark:bg-red-500/10",
    textClass: "text-red-700 dark:text-red-400",
  },
  dividend: {
    icon: "payments",
    label: "Dividend",
    bgClass: "bg-purple-100 dark:bg-purple-500/10",
    textClass: "text-purple-700 dark:text-purple-400",
  },
  interest: {
    icon: "percent",
    label: "Interest",
    bgClass: "bg-purple-100 dark:bg-purple-500/10",
    textClass: "text-purple-700 dark:text-purple-400",
  },
  fee: {
    icon: "receipt_long",
    label: "Fee",
    bgClass: "bg-orange-100 dark:bg-orange-500/10",
    textClass: "text-orange-700 dark:text-orange-400",
  },
  transfer: {
    icon: "swap_horiz",
    label: "Transfer",
    bgClass: "bg-blue-100 dark:bg-blue-500/10",
    textClass: "text-blue-700 dark:text-blue-400",
  },
  cash: {
    icon: "account_balance_wallet",
    label: "Cash",
    bgClass: "bg-gray-100 dark:bg-white/5",
    textClass: "text-gray-700 dark:text-gray-400",
  },
}

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.cash
}

// ─── Types ──────────────────────────────────────────────────────

interface Props {
  type: string
  name: string
  date: string
  quantity: number | null
  price: number | null
  amount: number
  fees: number | null
  security: { name: string | null; tickerSymbol: string | null } | null
}

// ─── Component ──────────────────────────────────────────────────

export function InvestmentTransactionRow({ type, name, date, quantity, price, amount, fees, security }: Props) {
  const config = getTypeConfig(type)

  return (
    <div className="flex items-center justify-between px-5 py-3 group hover:bg-background-secondary/30 transition-colors duration-150">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Type icon */}
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", config.bgClass)}>
          <span className={cn("material-symbols-rounded", config.textClass)} style={{ fontSize: 16 }}>
            {config.icon}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">
              {security?.name ?? name}
            </p>
            {security?.tickerSymbol && (
              <span className="inline-flex px-1.5 py-0.5 text-[9px] font-semibold uppercase bg-primary/8 text-primary rounded flex-shrink-0">
                {security.tickerSymbol}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-foreground-muted">
            <span className={cn("font-medium uppercase", config.textClass)}>{config.label}</span>
            <span className="text-foreground-muted/30">&middot;</span>
            <span>{new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            {quantity != null && price != null && (
              <>
                <span className="text-foreground-muted/30">&middot;</span>
                <span className="font-data tabular-nums">
                  {quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} &times; {formatCurrency(price)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="text-right flex-shrink-0 ml-3">
        <p className={cn(
          "font-data text-sm font-semibold tabular-nums",
          type === "buy" ? "text-error" : type === "sell" || type === "dividend" ? "text-success" : "text-foreground"
        )}>
          {type === "buy" ? "-" : type === "sell" || type === "dividend" ? "+" : ""}
          {formatCurrency(Math.abs(amount))}
        </p>
        {fees != null && fees > 0 && (
          <p className="text-[10px] text-foreground-muted font-data tabular-nums">
            Fee: {formatCurrency(fees)}
          </p>
        )}
      </div>
    </div>
  )
}
