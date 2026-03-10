import { formatCurrency, cn } from "@/lib/utils"

interface GalleryHeaderProps {
  totalBalance: number
  totalLimit: number
  utilization: number
  issuerCount: number
}

export function GalleryHeader({ totalBalance, totalLimit, utilization, issuerCount }: GalleryHeaderProps) {
  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Card Gallery</h2>
        <p className="text-foreground-muted text-sm mt-1">
          Manage your credit portfolio{issuerCount > 0 ? ` across ${issuerCount} institution${issuerCount !== 1 ? "s" : ""}` : ""}
        </p>
      </div>
      <div className="flex gap-4">
        <div className="bg-card/60 backdrop-blur-sm border border-card-border/50 p-4 rounded-xl min-w-[160px]">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-1">Total Balance</p>
          <p className="text-xl font-bold text-foreground font-data tabular-nums">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="bg-card/60 backdrop-blur-sm border border-card-border/50 p-4 rounded-xl min-w-[160px]">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-1">Credit Limit</p>
          <p className="text-xl font-bold text-foreground font-data tabular-nums">{formatCurrency(totalLimit)}</p>
          <p className={cn(
            "text-[10px] font-medium flex items-center gap-1 mt-1",
            utilization < 30 ? "text-success" : utilization < 50 ? "text-warning" : "text-error",
          )}>
            <span className="material-symbols-rounded" style={{ fontSize: 12 }}>
              {utilization < 30 ? "check_circle" : "warning"}
            </span>
            {utilization.toFixed(0)}% Utilization
          </p>
        </div>
      </div>
    </header>
  )
}
