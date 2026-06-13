/**
 * Whether the in-process cron scheduler (started in instrumentation.ts) is the
 * one driving background sync. It only runs when NODE_ENV === "production", so in
 * production the client should poll sync status read-only; in dev the client must
 * still advance/autoStart the worker itself because nothing else does.
 */
export const SCHEDULER_DRIVES_SYNC = process.env.NODE_ENV === "production"
