"use client"

import { useState, useEffect, useCallback } from "react"

export interface ChartColors {
  primary: string
  success: string
  error: string
  warning: string
  foreground: string
  foregroundMuted: string
  card: string
  border: string
  /** 6-8 color palette for multi-series charts (donut, category trends) */
  palette: string[]
}

const CSS_VARS: Record<keyof Omit<ChartColors, "palette">, string> = {
  primary: "--primary",
  success: "--success",
  error: "--error",
  warning: "--warning",
  foreground: "--foreground",
  foregroundMuted: "--foreground-muted",
  card: "--card",
  border: "--card-border",
}

const FALLBACK: ChartColors = {
  primary: "#007AFF",
  success: "#34C759",
  error: "#FF3B30",
  warning: "#FF9500",
  foreground: "#1D1D1F",
  foregroundMuted: "#8E8E93",
  card: "#FFFFFF",
  border: "#E5E5EA",
  palette: [
    "#007AFF", "#FF9500", "#34C759", "#AF52DE",
    "#FF2D55", "#5AC8FA", "#30D158", "#BF5AF2",
  ],
}

function resolveColors(): ChartColors {
  if (typeof document === "undefined") return FALLBACK

  const style = getComputedStyle(document.documentElement)

  const resolved = {} as Record<string, string>
  for (const [key, cssVar] of Object.entries(CSS_VARS)) {
    const raw = style.getPropertyValue(cssVar).trim()
    resolved[key] = raw || FALLBACK[key as keyof typeof FALLBACK] as string
  }

  // Build palette from resolved colors + extras
  const palette = [
    resolved.primary,
    resolved.warning,
    resolved.success,
    "#AF52DE", // purple
    "#FF2D55", // pink
    "#5AC8FA", // cyan
    "#30D158", // mint
    "#BF5AF2", // violet
  ]

  return { ...(resolved as Omit<ChartColors, "palette">), palette } as ChartColors
}

/**
 * Hook that reads CSS custom properties for Recharts colors.
 * Re-reads on theme change via MutationObserver on <html> class/data-theme.
 */
export function useChartTheme(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(
    () => typeof document !== "undefined" ? resolveColors() : FALLBACK
  )

  const update = useCallback(() => {
    setColors(resolveColors())
  }, [])

  useEffect(() => {
    // Initial resolve (after paint so CSS vars are available)
    requestAnimationFrame(update)

    // Watch for theme changes on <html>
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    })

    // Also listen for media query changes (system theme)
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    mq.addEventListener("change", update)

    return () => {
      observer.disconnect()
      mq.removeEventListener("change", update)
    }
  }, [update])

  return colors
}
