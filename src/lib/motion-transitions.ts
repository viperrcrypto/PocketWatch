/**
 * Shared Picasso-spec transition tokens for the motion primitive library.
 *
 * Ports the transitions.dev effect-set timings onto our existing motion v12
 * vocabulary (see `motion.ts`). Every primitive references these so the whole
 * library shares one timing language — no ad-hoc durations scattered around.
 *
 * Picasso rules baked in: hover 100-150ms, press 80-120ms, fade 150-250ms,
 * slide 200-350ms; arrive easing cubic-bezier(0.16,1,0.3,1) / overshoot
 * cubic-bezier(0.34,1.56,0.64,1). Never `linear` for UI, never `transition:
 * all`, never animate width/height/top/left (transform/opacity only).
 */

import type { Transition } from "motion/react"
import { easings } from "@/lib/motion"

// ─── Fine-grained durations (seconds) ──────────────────────────────

export const motionDurations = {
  /** Button press feedback — 80-120ms band. */
  press: 0.1,
  /** Hover state changes — 100-150ms band. */
  hover: 0.12,
  /** Opacity fades — 150-250ms band. */
  fade: 0.2,
  /** Slides / positional moves — 200-350ms band. */
  slide: 0.28,
} as const

// ─── Reusable easing-based transitions ─────────────────────────────

/** Arrive — decelerate into place. Default for fades/slides. */
export const arrive = (duration = motionDurations.fade): Transition => ({
  duration,
  ease: easings.out,
})

/** Overshoot — subtle kinetic pop. For pops/badges/success. */
export const overshoot = (duration = motionDurations.slide): Transition => ({
  duration,
  ease: easings.overshoot,
})

// ─── Spring presets tuned for the primitive set ────────────────────

/** Pop spring — number/badge/icon pops with a touch of bounce. */
export const popSpring: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 18,
  mass: 0.7,
}

/** Indicator spring — the sliding tab indicator follow. */
export const indicatorSpring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
}

/** Reduced-motion transition — instant, no animation. */
export const instant: Transition = { duration: 0 }

// ─── Stagger band (Picasso: 40-80ms interval, cap ~6-8) ────────────

export const STAGGER_INTERVAL_S = 0.06 // 60ms — mid of the 40-80ms band
export const STAGGER_CAP = 8 // group beyond this many items
export const STAGGER_TRANSLATE_PX = 12 // mid of the 8-16px band
