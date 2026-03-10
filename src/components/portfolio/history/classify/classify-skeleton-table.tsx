export function ClassifySkeletonTable() {
  const headers = ["", "Date", "Chain", "Tx Hash", "Dir", "Asset", "Amount", "Value", "Auto", "Manual", ""]
  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border bg-card-elevated">
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-3 text-xs font-medium text-foreground-muted whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-card-border">
                {Array.from({ length: 11 }).map((_, colIdx) => (
                  <td key={colIdx} className="px-4 py-3">
                    <div
                      className="h-4 bg-card-elevated rounded animate-pulse"
                      style={{ width: `${60 + ((rowIdx * 17 + colIdx * 11) % 31)}%` }}
                    />
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
