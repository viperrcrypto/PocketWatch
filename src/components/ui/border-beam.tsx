"use client"

import { useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

type BeamVariant = "beam" | "underglow"

interface BorderBeamProps {
  /**
   * "beam" (default) — traveling gradient ring + underglow.
   * "underglow" — soft gradient glow only, no traveling ring.
   */
  variant?: BeamVariant
  /** Border thickness in px. Default 1.5. */
  size?: number
  /**
   * One full loop duration in seconds. Default 6. Lower = faster.
   * (Alias `speed` is accepted for readability; if both set, `speed` wins.)
   */
  duration?: number
  /** Convenience alias for `duration` (seconds per loop). */
  speed?: number
  /** Corner radius in px to match the host card. Default 16 (var(--radius-lg)). */
  radius?: number
  /** Accent color (token). Default the app accent — warm, never purple. */
  color?: string
  className?: string
}

/**
 * Animated accent border + soft underglow. A masked conic-gradient ring travels
 * around the host element's edge to spotlight the "best" option, layered over a
 * warm underglow for depth. Set `variant="underglow"` for the glow alone.
 *
 * Render as a sibling inside a `position: relative` parent. The rotation is a
 * registered-custom-property CSS animation (`--beam-angle`, see globals.css), so
 * the global `prefers-reduced-motion` rule already neutralizes it; we also drop
 * the animating layer entirely via `useReducedMotion`, leaving a static glow.
 *
 * @example <div className="relative card"><BorderBeam radius={16} /> …</div>
 */
export function BorderBeam({
  variant = "beam",
  size = 1.5,
  duration = 6,
  speed,
  radius = 16,
  color = "var(--primary)",
  className,
}: BorderBeamProps) {
  const reduce = useReducedMotion()
  const loop = speed ?? duration

  // Accent arc fading into transparency, rotated by --beam-angle.
  const ring = `conic-gradient(from var(--beam-angle, 0deg), transparent 0deg, ${color} 55deg, transparent 130deg)`

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ borderRadius: radius }}
      aria-hidden="true"
    >
      {/* Soft layered underglow — depth, warmth, not a flat outline */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: radius,
          boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 28%, transparent), 0 6px 24px -8px color-mix(in srgb, ${color} 45%, transparent)`,
        }}
      />

      {/* Traveling ring — masked to a thin border band via padding-box xor */}
      {variant === "beam" && !reduce && (
        <div
          className="absolute inset-0 animate-beam"
          style={{
            borderRadius: radius,
            padding: size,
            background: ring,
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            maskComposite: "exclude",
            ["--beam-duration" as string]: `${loop}s`,
          }}
        />
      )}
    </div>
  )
}

interface GradientUnderglowProps {
  /** Corner radius in px to match the host card. Default 16. */
  radius?: number
  /** Accent color (token). Default the app accent — warm, never purple. */
  color?: string
  /** Glow intensity 0-1 (default 0.45). */
  intensity?: number
  className?: string
}

/**
 * Static soft gradient underglow — a warm halo + hairline ring for depth on
 * elevated surfaces. No animation, so it's reduced-motion-safe by definition.
 * This is the `variant="underglow"` of BorderBeam, exported standalone for
 * places that never want the traveling ring.
 *
 * @example <div className="relative card"><GradientUnderglow /> …</div>
 */
export function GradientUnderglow({
  radius = 16,
  color = "var(--primary)",
  intensity = 0.45,
  className,
}: GradientUnderglowProps) {
  const ringPct = Math.round(intensity * 62)
  const glowPct = Math.round(intensity * 100)
  return (
    <div
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        borderRadius: radius,
        boxShadow: `0 0 0 1px color-mix(in srgb, ${color} ${ringPct}%, transparent), 0 8px 30px -10px color-mix(in srgb, ${color} ${glowPct}%, transparent)`,
      }}
      aria-hidden="true"
    />
  )
}
