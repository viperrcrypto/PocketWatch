/**
 * Next.js instrumentation hook — runs once on server startup.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the Node.js server runtime, not Edge
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recoverOrphanedJobs } = await import("@/lib/portfolio/sync-recovery")

    try {
      const result = await recoverOrphanedJobs()
      if (result.historySyncRecovered > 0 || result.refreshRecovered > 0) {
        console.log("[instrumentation] Startup recovery complete:", result)
      }
    } catch (err) {
      // Don't block startup if DB isn't ready yet
      console.error("[instrumentation] Startup recovery failed:", err)
    }
  }
}
