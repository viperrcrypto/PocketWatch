"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { formatCurrency } from "@/lib/utils"
import { useTransactionLocations } from "@/hooks/finance/use-locations"
import { WhereIveBeenMap } from "./where-ive-been-map"
import { WhereIveBeenStats } from "./where-ive-been-stats"

interface Props {
  open: boolean
  onClose: () => void
}

export function WhereIveBeenModal({ open, onClose }: Props) {
  const { data, isLoading } = useTransactionLocations()

  // Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          {/* Content */}
          <motion.div
            className="relative bg-card rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ width: "min(95vw, 1400px)", height: "min(90vh, 850px)" }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
              <div className="flex items-center gap-3">
                <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>public</span>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Where I've Been</h2>
                  {data && (
                    <p className="text-xs text-foreground-muted">
                      {data.stats.countryCount} {data.stats.countryCount === 1 ? "country" : "countries"} &middot; {data.stats.cityCount} {data.stats.cityCount === 1 ? "city" : "cities"} &middot; {data.stats.transactionCount.toLocaleString()} transactions &middot; {formatCurrency(data.stats.totalSpent)} spent
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            {/* Body */}
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="h-10 w-10 mx-auto mb-3 border-2 border-foreground-muted/20 border-t-primary rounded-full animate-spin" />
                  <p className="text-sm text-foreground-muted">Loading your travel map...</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col lg:flex-row min-h-0">
                {/* Map — takes most of the space */}
                <div className="flex-1 min-h-[300px] lg:min-h-0">
                  <WhereIveBeenMap locations={data?.locations ?? []} />
                </div>

                {/* Stats sidebar */}
                <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-card-border flex flex-col max-h-[300px] lg:max-h-none">
                  <div className="px-4 py-3 border-b border-card-border/50">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted">By Country</span>
                  </div>
                  <WhereIveBeenStats locations={data?.locations ?? []} />
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
