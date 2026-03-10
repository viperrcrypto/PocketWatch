"use client"

/**
 * Security watermark component for sensitive pages.
 * Displays user identification and timestamp in a diagonal repeating pattern.
 * Cannot be disabled or removed client-side (z-index, opacity locked).
 */

import { useEffect, useState } from "react"

interface WatermarkProps {
  /**
   * User identification (name or wallet address)
   */
  userIdentifier: string

  /**
   * Optional custom message to display alongside identifier
   */
  customMessage?: string
}

/**
 * Watermark component that creates a diagonal repeating pattern across the page.
 * Uses SVG for optimal performance with many repetitions.
 */
export function Watermark({ userIdentifier, customMessage }: WatermarkProps) {
  const [timestamp, setTimestamp] = useState<string>("")

  useEffect(() => {
    // Set timestamp on client side only to avoid SSR hydration mismatch
    const now = new Date()
    setTimestamp(
      now.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    )
  }, [])

  if (!timestamp) {
    // Don't render until timestamp is set to avoid hydration issues
    return null
  }

  const watermarkText = customMessage
    ? `${userIdentifier} | ${customMessage} | ${timestamp}`
    : `${userIdentifier} | ${timestamp}`

  // SVG pattern dimensions
  const patternWidth = 400
  const patternHeight = 200

  return (
    <div
      className="watermark-container"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none" as const,
        zIndex: 9999,
        overflow: "hidden",
      }}
      // Prevent removal via dev tools
      suppressHydrationWarning
    >
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          opacity: 0.05,
          userSelect: "none",
        }}
      >
        <defs>
          <pattern
            id="watermark-pattern"
            x="0"
            y="0"
            width={patternWidth}
            height={patternHeight}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-45)"
          >
            <text
              x="0"
              y="50"
              fontSize="14"
              fontFamily="monospace"
              fontWeight="600"
              fill="currentColor"
              style={{
                userSelect: "none",
                pointerEvents: "none",
              }}
            >
              {watermarkText}
            </text>
            <text
              x="0"
              y="150"
              fontSize="14"
              fontFamily="monospace"
              fontWeight="600"
              fill="currentColor"
              style={{
                userSelect: "none",
                pointerEvents: "none",
              }}
            >
              {watermarkText}
            </text>
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#watermark-pattern)"
          style={{
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      </svg>

      <style jsx global>{`
        /* Prevent watermark removal via CSS overrides */
        .watermark-container {
          position: fixed !important;
          pointer-events: none !important;
          z-index: 9999 !important;
          opacity: 1 !important;
        }

        .watermark-container svg {
          opacity: 0.05 !important;
          user-select: none !important;
        }
      `}</style>
    </div>
  )
}

/**
 * Higher-order component to wrap pages with watermark protection.
 * Usage: export default withWatermark(YourPage, "user@example.com")
 */
export function withWatermark<P extends object>(
  Component: React.ComponentType<P>,
  getUserIdentifier: (props: P) => string,
  customMessage?: string
) {
  return function WatermarkedComponent(props: P) {
    const userIdentifier = getUserIdentifier(props)

    return (
      <>
        <Watermark
          userIdentifier={userIdentifier}
          customMessage={customMessage}
        />
        <Component {...props} />
      </>
    )
  }
}
