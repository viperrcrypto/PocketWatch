"use client"

import React, { Component, type ReactNode, useCallback, useState } from "react"
import { usePathname } from "next/navigation"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  fallbackRender?: (error: Error | undefined, reset: () => void) => ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child components and displays fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error Boundary caught an error:", error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallbackRender) {
        return this.props.fallbackRender(this.state.error, this.reset)
      }

      if (this.props.fallback !== undefined) {
        return this.props.fallback
      }

      return <ErrorFallback error={this.state.error} reset={this.reset} />
    }

    return this.props.children
  }
}

/**
 * Page Error Boundary — scoped to page content only.
 *
 * Auto-resets when the user navigates to a different route (pathname changes).
 * Uses pathname as React key so the ErrorBoundary remounts on navigation,
 * clearing any caught errors and letting the new page render fresh.
 *
 * Renders an inline error card (not full-screen) so sidebar/header stay visible.
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <ErrorBoundary
      key={pathname}
      fallbackRender={(error, reset) => (
        <PageErrorFallback error={error} reset={reset} />
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * Inline error fallback for page content area.
 * Maintains layout context — sidebar and header remain visible.
 */
function PageErrorFallback({
  error,
  reset,
}: {
  error?: Error
  reset: () => void
}) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="flex items-center justify-center py-20 px-4 fade-in">
      <div className="max-w-md w-full">
        <div className="border-2 border-error/30 bg-card rounded-xl p-8 text-center">
          <div className="mb-5">
            <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-xl border border-error/20 bg-error-muted">
              <span className="material-symbols-rounded text-3xl text-error">
                error
              </span>
            </div>
          </div>

          <h2 className="text-lg font-semibold mb-3">
            Something Went Wrong
          </h2>

          <p className="text-foreground-muted mb-4 text-sm leading-relaxed">
            This page encountered an error. Your navigation and data are safe.
          </p>

          {error && (
            <div className="mb-4">
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="text-[10px] text-foreground-muted hover:text-foreground transition-colors"
              >
                {showDetails ? "Hide" : "Show"} Details
              </button>
              {showDetails && (
                <pre className="mt-2 p-3 bg-background-secondary border border-card-border rounded-lg text-[10px] text-error/80 text-left overflow-auto max-h-32 font-data">
                  {error.message}
                </pre>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="btn-secondary flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              <span className="material-symbols-rounded text-base">refresh</span>
              Retry
            </button>
            <a
              href="/home"
              className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              <span className="material-symbols-rounded text-base">home</span>
              Home
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Default full-screen Error Fallback UI (used by root layout ErrorBoundary)
 */
interface ErrorFallbackProps {
  error?: Error
  reset: () => void
}

function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full">
        <div className="border-2 border-error bg-card rounded-xl p-8 text-center">
          <div className="mb-4">
            <span className="material-symbols-rounded text-6xl text-error">
              error
            </span>
          </div>

          <h1 className="text-2xl font-semibold mb-4">
            Something Went Wrong
          </h1>

          <p className="text-foreground-muted mb-6 text-sm">
            An unexpected error occurred. Our team has been notified.
          </p>

          {error && (
            <details className="mb-6 text-left">
              <summary className="cursor-pointer text-xs text-foreground-muted mb-2">
                Error Details
              </summary>
              <pre className="bg-background-secondary p-4 border border-card-border rounded-lg text-xs overflow-auto max-h-40 font-data">
                {error.message}
              </pre>
            </details>
          )}

          <div className="flex gap-4 justify-center">
            <button
              onClick={reset}
              className="btn-secondary px-6 py-2 text-sm"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = "/home"}
              className="btn-primary px-6 py-2 text-sm"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Async Error Boundary Hook
 */
export function useAsyncError() {
  const [, setError] = React.useState()

  return React.useCallback((error: unknown) => {
    setError(() => {
      throw error
    })
  }, [])
}
