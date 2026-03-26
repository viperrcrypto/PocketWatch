/**
 * In-process cron scheduler — replaces Vercel cron jobs.
 * Started once in instrumentation.ts on server boot.
 * Each job has a concurrency guard to prevent pile-up.
 */
import cron from "node-cron"

const PORT = process.env.PORT ?? "3500"
const BASE_URL = `http://localhost:${PORT}`

interface JobConfig {
  readonly name: string
  readonly schedule: string
  readonly endpoint: string
  readonly method: "GET" | "POST"
  readonly headers: Record<string, string>
}

function bearerHeader(secret: string | undefined): Record<string, string> {
  if (!secret) return {}
  return { Authorization: `Bearer ${secret}` }
}

function customHeader(
  key: string,
  secret: string | undefined,
): Record<string, string> {
  if (!secret) return {}
  return { [key]: secret }
}

function buildJobs(): readonly JobConfig[] {
  return [
    {
      name: "history-sync",
      schedule: "* * * * *",
      endpoint: "/api/internal/history/sync-worker",
      method: "POST",
      headers: customHeader(
        "x-history-cron-secret",
        process.env.HISTORY_CRON_SECRET,
      ),
    },
    {
      name: "finance-sync",
      schedule: "*/15 * * * *",
      endpoint: "/api/internal/finance-sync-worker",
      method: "POST",
      headers: customHeader(
        "x-finance-sync-secret",
        process.env.FINANCE_SYNC_SECRET,
      ),
    },
    {
      name: "portfolio-refresh",
      schedule: "*/2 * * * *",
      endpoint: "/api/internal/portfolio/refresh-worker",
      method: "POST",
      headers: customHeader(
        "x-portfolio-refresh-cron-secret",
        process.env.PORTFOLIO_REFRESH_CRON_SECRET,
      ),
    },
    {
      name: "staking-snapshot",
      schedule: "0 * * * *",
      endpoint: "/api/internal/staking/snapshot-hourly",
      method: "POST",
      headers: customHeader(
        "x-staking-cron-secret",
        process.env.STAKING_CRON_SECRET,
      ),
    },
    {
      name: "snapshot-worker",
      schedule: "*/5 * * * *",
      endpoint: "/api/internal/snapshot-worker",
      method: "POST",
      headers: bearerHeader(process.env.SNAPSHOT_WORKER_SECRET),
    },
    {
      name: "classify-transactions",
      schedule: "*/10 * * * *",
      endpoint: "/api/internal/classify-transactions",
      method: "POST",
      headers: bearerHeader(process.env.SNAPSHOT_WORKER_SECRET),
    },
    {
      name: "backup-worker",
      schedule: "0 */6 * * *",
      endpoint: "/api/internal/backup-worker",
      method: "POST",
      headers: bearerHeader(
        process.env.BACKUP_CRON_SECRET ?? process.env.SNAPSHOT_WORKER_SECRET,
      ),
    },
  ] as const
}

function createTask(job: JobConfig): ReturnType<typeof cron.schedule> {
  let running = false

  return cron.schedule(job.schedule, async () => {
    if (running) {
      console.warn(
        `[scheduler] ${job.name} skipped — previous invocation still running`,
      )
      return
    }
    running = true
    const start = Date.now()
    try {
      const res = await fetch(`${BASE_URL}${job.endpoint}`, {
        method: job.method,
        headers: { "Content-Type": "application/json", ...job.headers },
        signal: AbortSignal.timeout(120_000),
      })
      const elapsed = Date.now() - start
      if (!res.ok) {
        console.error(
          `[scheduler] ${job.name} HTTP ${res.status} (${elapsed}ms)`,
        )
      }
    } catch (err) {
      const elapsed = Date.now() - start
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[scheduler] ${job.name} failed (${elapsed}ms): ${msg}`)
    } finally {
      running = false
    }
  })
}

const REQUIRED_SECRETS: Record<string, string> = {
  HISTORY_CRON_SECRET: "history-sync",
  FINANCE_SYNC_SECRET: "finance-sync",
  PORTFOLIO_REFRESH_CRON_SECRET: "portfolio-refresh",
  STAKING_CRON_SECRET: "staking-snapshot",
  SNAPSHOT_WORKER_SECRET: "snapshot-worker, classify-transactions, backup-worker",
}

export function startScheduler(): () => void {
  // Warn about missing secrets at startup
  for (const [envVar, jobNames] of Object.entries(REQUIRED_SECRETS)) {
    if (!process.env[envVar]) {
      console.warn(
        `[scheduler] WARNING: ${envVar} not set — ${jobNames} will fail with 401`,
      )
    }
  }

  const jobs = buildJobs()
  const tasks = jobs.map(createTask)
  console.log(
    `[scheduler] Started ${tasks.length} cron jobs: ${jobs.map((j) => j.name).join(", ")}`,
  )
  return () => {
    for (const t of tasks) t.stop()
    console.log("[scheduler] Stopped all cron jobs")
  }
}
