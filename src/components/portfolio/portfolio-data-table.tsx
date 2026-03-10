"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Wrapper to group a data row + its expanded detail row in tbody */
function ExpandableRowGroup({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export interface Column<T> {
  key: string
  header: string
  accessor: (row: T) => ReactNode
  sortable?: boolean
  align?: "left" | "right" | "center"
  width?: string
}

interface PortfolioDataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  emptyMessage?: string
  emptyIcon?: string
  tableClassName?: string
  onRowClick?: (row: T) => void
  sortKey?: string
  sortDir?: "asc" | "desc"
  onSort?: (key: string) => void
  getRowKey?: (row: T, index: number) => string
  getRowClassName?: (row: T, index: number) => string | undefined
  /** Render an expandable detail row below a data row. Return null to skip. */
  renderExpandedRow?: (row: T) => ReactNode | null
  /** Set of row keys that are currently expanded */
  expandedKeys?: Set<string>
  /** Toggle expand/collapse for a row key */
  onToggleExpand?: (key: string) => void
}

function getSkeletonWidth(row: number, col: number) {
  return 60 + ((row * 17 + col * 11) % 31)
}

function SkeletonRow({ cols, rowIndex }: { cols: number; rowIndex: number }) {
  return (
    <tr className="border-b border-card-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 bg-card-elevated rounded animate-pulse"
            style={{ width: `${getSkeletonWidth(rowIndex, i)}%` }}
          />
        </td>
      ))}
    </tr>
  )
}

export function PortfolioDataTable<T>({
  columns,
  data,
  isLoading,
  emptyMessage = "No data available",
  emptyIcon = "inbox",
  tableClassName,
  onRowClick,
  sortKey,
  sortDir,
  onSort,
  getRowKey,
  getRowClassName,
  renderExpandedRow,
  expandedKeys,
  onToggleExpand,
}: PortfolioDataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className={cn("w-full", tableClassName)}>
            <thead>
              <tr className="border-b border-card-border bg-card-elevated">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-3 text-xs font-medium text-foreground-muted",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center"
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} cols={columns.length} rowIndex={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl py-16 text-center">
        <span className="material-symbols-rounded text-5xl text-foreground-muted block mb-3">
          {emptyIcon}
        </span>
        <p className="text-sm text-foreground-muted">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className={cn("w-full", tableClassName)}>
          <thead>
            <tr className="border-b border-card-border bg-card-elevated">
              {columns.map((col) => {
                const isSorted = sortKey === col.key
                const canSort = col.sortable && onSort

                return (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-3 text-xs font-medium text-foreground-muted whitespace-nowrap",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      canSort && "cursor-pointer select-none hover:text-foreground transition-colors"
                    )}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={canSort ? () => onSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {col.header}
                      {canSort && (
                        isSorted ? (
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            {sortDir === "asc"
                              ? <path d="M12 19V5m-5 5 5-5 5 5" />
                              : <path d="M12 5v14m-5-5 5 5 5-5" />}
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 shrink-0 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="m7 10 5-5 5 5M7 14l5 5 5-5" />
                          </svg>
                        )
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => {
              const rowKey = getRowKey ? getRowKey(row, rowIdx) : String(rowIdx)
              const isExpanded = expandedKeys?.has(rowKey)
              // Always check if a row can expand (to set cursor style), render content only when expanded
              const canExpand = renderExpandedRow ? renderExpandedRow(row) !== null : false
              const expandedContent = isExpanded && canExpand ? renderExpandedRow!(row) : null

              return (
                <ExpandableRowGroup key={rowKey}>
                  <tr
                    className={cn(
                      "border-b border-card-border transition-colors",
                      !expandedContent && "last:border-b-0",
                      "hover:bg-primary-subtle",
                      (onRowClick || (onToggleExpand && canExpand)) && "cursor-pointer",
                      getRowClassName?.(row, rowIdx)
                    )}
                    onClick={
                      onRowClick
                        ? () => onRowClick(row)
                        : onToggleExpand && canExpand
                          ? () => onToggleExpand(rowKey)
                          : undefined
                    }
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-3 text-sm whitespace-nowrap",
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center"
                        )}
                      >
                        {col.accessor(row)}
                      </td>
                    ))}
                  </tr>
                  {expandedContent && (
                    <tr className="bg-card-elevated/50 border-b border-card-border last:border-b-0">
                      <td colSpan={columns.length} className="px-4 py-0">
                        {expandedContent}
                      </td>
                    </tr>
                  )}
                </ExpandableRowGroup>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
