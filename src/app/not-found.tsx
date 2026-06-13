import Link from "next/link"

export default function NotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center bg-background px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 32 }} aria-hidden="true">
            travel_explore
          </span>
        </div>
        <p className="font-data text-5xl font-black text-foreground tabular-nums" style={{ letterSpacing: "-0.04em" }}>
          404
        </p>
        <h1 className="mt-3 text-lg font-semibold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          That page doesn&rsquo;t exist or may have moved. Let&rsquo;s get you back on track.
        </p>
        <Link
          href="/net-worth"
          className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">
            arrow_back
          </span>
          Back to dashboard
        </Link>
      </div>
    </main>
  )
}
