"use client"

import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { useSyncProgress } from "@/hooks/use-portfolio-tracker"
import { useSyncStatus } from "@/hooks/use-portfolio-sync-status"
import { cn } from "@/lib/utils"

const VARIANT_STYLES: Record<string, string> = {
  info: "border-primary/30 text-primary",
  warning: "border-warning/40 text-warning",
  muted: "border-card-border text-foreground-muted",
}

/**
 * Small floating pill that shows portfolio sync activity on EVERY page (not just
 * the portfolio dashboard), so it's clear the sync runs in the background — and,
 * when Zerion/Alchemy rate-limit a large wallet set, that it's paused-and-resuming
 * rather than stuck. Reads the same cached sync data GlobalSyncPoller maintains.
 */
export function GlobalSyncIndicator() {
  const reduce = useReducedMotion()
  const { data: syncProgress } = useSyncProgress({ advance: false, autoStart: false })
  const status = useSyncStatus(null, syncProgress)

  const active = !!status?.active
  const spin = active && status?.icon === "sync" && !reduce

  return (
    <AnimatePresence>
      {active && status && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "fixed bottom-4 left-4 z-40 hidden md:flex items-center gap-2 px-3 py-2 rounded-full",
            "bg-card border text-xs font-medium",
            VARIANT_STYLES[status.variant] ?? VARIANT_STYLES.muted,
          )}
          style={{ boxShadow: "var(--shadow-md)" }}
          role="status"
          aria-live="polite"
          title={status.detail}
        >
          <span className={cn("material-symbols-rounded", spin && "animate-spin")} style={{ fontSize: 16 }} aria-hidden="true">
            {status.icon}
          </span>
          <span className="whitespace-nowrap">
            {status.title}
            {status.showProgress && typeof status.progress === "number" ? ` · ${status.progress}%` : ""}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
