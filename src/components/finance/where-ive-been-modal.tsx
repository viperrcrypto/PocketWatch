"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
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

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [open])

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            className="relative w-full h-full max-w-[1400px] max-h-[860px] bg-card rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-card-border"
            initial={{ scale: 0.93, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-card-border bg-card z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>travel_explore</span>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Where I've Been</h2>
                  {data && (
                    <p className="text-[10px] text-foreground-muted mt-0.5">
                      {data.stats.countryCount} {data.stats.countryCount === 1 ? "country" : "countries"} &middot; {data.stats.cityCount} cities &middot; {data.stats.transactionCount.toLocaleString()} transactions &middot; {formatCurrency(data.stats.totalSpent)}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors">
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>close</span>
              </button>
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="h-10 w-10 border-2 border-card-border border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex-1 flex flex-col lg:flex-row min-h-0">
                <div className="flex-1 min-h-[300px] lg:min-h-0">
                  <WhereIveBeenMap locations={data?.locations ?? []} />
                </div>
                <div className="w-full lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-card-border flex flex-col max-h-[240px] lg:max-h-none">
                  <div className="px-4 py-2.5 border-b border-card-border/50 flex-shrink-0">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-foreground-muted">By Country</span>
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

  if (typeof document === "undefined") return null
  return createPortal(content, document.body)
}
