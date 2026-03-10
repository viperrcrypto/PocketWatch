"use client"

import { useState, useMemo } from "react"
import { useManualBalances, useAddManualBalance } from "@/hooks/use-portfolio-tracker"
import { formatCryptoAmount, formatFiatValue } from "@/lib/portfolio/utils"
import { PortfolioPageHeader } from "@/components/portfolio/portfolio-page-header"
import { PortfolioSubNav } from "@/components/portfolio/portfolio-sub-nav"
import { PortfolioDataTable, Column } from "@/components/portfolio/portfolio-data-table"
import { BALANCE_SUB_TABS } from "@/lib/portfolio/nav"

interface ManualBalanceRow {
  label: string
  asset: string
  displayName: string
  amount: number
  usd_value: number
  location: string
  tags: string[]
}

export default function ManualBalancesPage() {
  const { data, isLoading, isError } = useManualBalances()
  const addManualBalance = useAddManualBalance()

  const [sortKey, setSortKey] = useState("label")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  // Add dialog state
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [formLabel, setFormLabel] = useState("")
  const [formAsset, setFormAsset] = useState("")
  const [formAmount, setFormAmount] = useState("")
  const [formLocation, setFormLocation] = useState("")
  const [addError, setAddError] = useState("")

  // Parse manual balances from rotki response (rotkiClient already extracts .result)
  const rows = useMemo(() => {
    if (!data) return [] as ManualBalanceRow[]

    const result = data
    const items: ManualBalanceRow[] = []

    // Handle array format (common for manual balances)
    const balanceList = Array.isArray(result)
      ? result
      : result.balances && Array.isArray(result.balances)
        ? result.balances
        : []

    for (const entry of balanceList) {
      if (!entry || typeof entry !== "object") continue
      const e = entry as Record<string, unknown>
      const assetId = String(e.asset || "")
      const displayName = assetId.includes("::")
        ? assetId.split("::").pop() || assetId
        : assetId
      items.push({
        label: String(e.label || ""),
        asset: assetId,
        displayName,
        amount: parseFloat(String(e.amount || "0")),
        usd_value: parseFloat(String(e.usd_value || "0")),
        location: String(e.location || ""),
        tags: Array.isArray(e.tags) ? (e.tags as string[]) : [],
      })
    }

    // Also handle object-keyed format
    if (balanceList.length === 0 && result && typeof result === "object" && !Array.isArray(result)) {
      for (const [key, val] of Object.entries(result)) {
        if (key === "balances") continue
        if (val && typeof val === "object") {
          const e = val as Record<string, unknown>
          const assetId = String(e.asset || key)
          const displayName = assetId.includes("::")
            ? assetId.split("::").pop() || assetId
            : assetId
          items.push({
            label: String(e.label || key),
            asset: assetId,
            displayName,
            amount: parseFloat(String(e.amount || "0")),
            usd_value: parseFloat(String(e.usd_value || "0")),
            location: String(e.location || ""),
            tags: Array.isArray(e.tags) ? (e.tags as string[]) : [],
          })
        }
      }
    }

    return items
  }, [data])

  // Sort rows
  const sortedRows = useMemo(() => {
    const sorted = [...rows]
    sorted.sort((a, b) => {
      let aVal: number | string
      let bVal: number | string

      switch (sortKey) {
        case "asset":
          aVal = a.displayName.toLowerCase()
          bVal = b.displayName.toLowerCase()
          break
        case "amount":
          aVal = a.amount
          bVal = b.amount
          break
        case "location":
          aVal = a.location.toLowerCase()
          bVal = b.location.toLowerCase()
          break
        case "label":
        default:
          aVal = a.label.toLowerCase()
          bVal = b.label.toLowerCase()
          break
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
    return sorted
  }, [rows, sortKey, sortDir])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const resetForm = () => {
    setFormLabel("")
    setFormAsset("")
    setFormAmount("")
    setFormLocation("")
    setAddError("")
  }

  const handleAdd = () => {
    if (!formLabel.trim()) {
      setAddError("Label is required")
      return
    }
    if (!formAsset.trim()) {
      setAddError("Asset is required")
      return
    }
    if (!formAmount.trim() || isNaN(Number(formAmount))) {
      setAddError("Valid amount is required")
      return
    }
    setAddError("")

    addManualBalance.mutate(
      {
        label: formLabel.trim(),
        asset: formAsset.trim(),
        amount: formAmount.trim(),
        location: formLocation.trim() || undefined,
      },
      {
        onSuccess: () => {
          setShowAddDialog(false)
          resetForm()
        },
        onError: (err) => setAddError(err.message),
      }
    )
  }

  const columns: Column<ManualBalanceRow>[] = [
    {
      key: "label",
      header: "Label",
      sortable: true,
      accessor: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-card-border flex items-center justify-center rounded-md text-foreground-muted">
            <span className="material-symbols-rounded text-xs">edit_note</span>
          </div>
          <span className="text-foreground text-sm font-medium">
            {row.label}
          </span>
        </div>
      ),
    },
    {
      key: "asset",
      header: "Asset",
      sortable: true,
      accessor: (row) => (
        <span className="text-foreground text-sm">
          {row.displayName}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      align: "right",
      accessor: (row) => (
        <span className="text-foreground-muted font-data text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatCryptoAmount(row.amount)}
        </span>
      ),
    },
    {
      key: "location",
      header: "Location",
      sortable: true,
      accessor: (row) => (
        <span className="text-foreground-muted text-sm capitalize">
          {row.location || "\u2014"}
        </span>
      ),
    },
    {
      key: "tags",
      header: "Tags",
      accessor: (row) => (
        <div className="flex items-center gap-1 flex-wrap">
          {row.tags.length > 0 ? (
            row.tags.map((tag) => (
              <span
                key={tag}
                className="inline-block px-2 py-0.5 border border-card-border text-foreground-muted rounded text-[10px] tracking-wide"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="text-foreground-muted text-sm">
              {"\u2014"}
            </span>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-0">
      <PortfolioSubNav tabs={BALANCE_SUB_TABS} />

      <PortfolioPageHeader
        title="Manual Balances"
        subtitle="Track balances that are not automatically detected"
        actions={
          <button
            onClick={() => setShowAddDialog(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide"
          >
            <span className="material-symbols-rounded text-sm">add</span>
            Add Balance
          </button>
        }
      />

      {/* Add Manual Balance Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-card-border w-full max-w-lg rounded-2xl shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
              <h2 className="text-foreground text-base font-semibold">
                Add Manual Balance
              </h2>
              <button
                onClick={() => {
                  setShowAddDialog(false)
                  resetForm()
                }}
                className="text-foreground-muted hover:text-foreground transition-colors"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Label */}
              <div>
                <label className="block mb-2 text-foreground-muted text-xs font-semibold tracking-wider">
                  Label
                </label>
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="e.g. Cold Storage BTC"
                  className="w-full bg-transparent border-b border-card-border focus:border-foreground outline-none py-2 text-foreground placeholder-foreground-muted transition-colors text-sm"
                />
              </div>

              {/* Asset */}
              <div>
                <label className="block mb-2 text-foreground-muted text-xs font-semibold tracking-wider">
                  Asset
                </label>
                <input
                  type="text"
                  value={formAsset}
                  onChange={(e) => setFormAsset(e.target.value)}
                  placeholder="e.g. BTC, ETH, USDC"
                  className="w-full bg-transparent border-b border-card-border focus:border-foreground outline-none py-2 text-foreground placeholder-foreground-muted transition-colors text-sm"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block mb-2 text-foreground-muted text-xs font-semibold tracking-wider">
                  Amount
                </label>
                <input
                  type="text"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent border-b border-card-border focus:border-foreground outline-none py-2 text-foreground placeholder-foreground-muted transition-colors text-sm"
                />
              </div>

              {/* Location (optional) */}
              <div>
                <label className="block mb-2 text-foreground-muted text-xs font-semibold tracking-wider">
                  Location
                  <span className="text-foreground-muted ml-2 text-[9px] tracking-wide">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="e.g. hardware wallet, bank, etc."
                  className="w-full bg-transparent border-b border-card-border focus:border-foreground outline-none py-2 text-foreground placeholder-foreground-muted transition-colors text-sm"
                />
              </div>

              {addError && (
                <p className="text-error text-xs">{addError}</p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowAddDialog(false)
                    resetForm()
                  }}
                  className="px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={addManualBalance.isPending}
                  className="btn-primary px-4 py-2 rounded-xl disabled:opacity-50 text-xs font-semibold"
                >
                  {addManualBalance.isPending ? "Adding..." : "Add Balance"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isError && (
        <div className="bg-card border border-card-border p-6 mb-6 rounded-xl">
          <div className="flex items-center gap-3 text-error">
            <span className="material-symbols-rounded">error</span>
            <span className="text-sm">
              Failed to load manual balances. Please try again.
            </span>
          </div>
        </div>
      )}

      <PortfolioDataTable
        columns={columns}
        data={sortedRows}
        isLoading={isLoading}
        emptyMessage="No manual balances added yet"
        emptyIcon="edit_note"
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />
    </div>
  )
}
