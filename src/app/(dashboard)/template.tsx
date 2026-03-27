"use client"

import { PageTransition } from "@/components/motion/page-transition"

/**
 * Dashboard template — re-renders on every route change.
 * Wraps all dashboard page content in a page entrance animation.
 */
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return <PageTransition>{children}</PageTransition>
}
