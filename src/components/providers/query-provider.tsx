"use client"

import { ReactNode, useRef } from "react"
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query"

function handleAuthError(error: unknown) {
  if (
    error instanceof Error &&
    error.message.toLowerCase().includes("authentication required") &&
    typeof window !== "undefined"
  ) {
    // Redirect to login — only once per page to avoid redirect loops
    const key = "__pw_auth_redirect"
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1")
      window.location.href = `/?redirect=${encodeURIComponent(window.location.pathname)}`
    }
  }
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: handleAuthError,
    }),
    mutationCache: new MutationCache({
      onError: handleAuthError,
    }),
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        retry: (failureCount, error) => {
          // Don't retry auth errors
          if (error instanceof Error && error.message.toLowerCase().includes("authentication required")) {
            return false
          }
          return failureCount < 1
        },
      },
    },
  })
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<QueryClient | null>(null)
  if (!clientRef.current) {
    clientRef.current = makeQueryClient()
  }

  return (
    <QueryClientProvider client={clientRef.current}>
      {children}
    </QueryClientProvider>
  )
}
