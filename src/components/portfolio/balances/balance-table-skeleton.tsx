export function BalanceTableSkeleton() {
  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border bg-card-elevated">
              <th className="px-4 py-3 text-xs font-medium text-foreground-muted">Asset</th>
              <th className="px-4 py-3 text-xs font-medium text-foreground-muted">Wallet</th>
              <th className="px-4 py-3 text-xs font-medium text-foreground-muted">Chain</th>
              <th className="px-4 py-3 text-xs font-medium text-foreground-muted text-right">Amount</th>
              <th className="px-4 py-3 text-xs font-medium text-foreground-muted text-right">Value (USD)</th>
              <th className="px-4 py-3 text-xs font-medium text-foreground-muted text-right">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-card-border">
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 bg-card-elevated rounded animate-pulse" style={{ width: `${60 + ((i * 17 + j * 11) % 31)}%` }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
