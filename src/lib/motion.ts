/**
 * Motion animation presets — springs, variants, and reduced-motion helpers.
 * Uses the `motion` package (modern Framer Motion v12+).
 */

import type { Transition, Variants } from "motion/react"

// ─── Spring Presets ────────────────────────────────────────────────

export const springs = {
  /** Buttons, tabs, small snappy interactions */
  snappy: { type: "spring", stiffness: 500, damping: 30 } as const,
  /** Cards, page elements — natural deceleration */
  gentle: { type: "spring", stiffness: 200, damping: 20 } as const,
  /** Modals, emphasis — visible bounce */
  bouncy: { type: "spring", stiffness: 400, damping: 15 } as const,
  /** Page transitions, large elements — smooth ease */
  smooth: { type: "spring", stiffness: 120, damping: 20 } as const,
} satisfies Record<string, Transition>

// ─── Duration Presets ──────────────────────────────────────────────

export const durations = {
  fast: 0.15,
  base: 0.25,
  slow: 0.35,
  /** Skeleton crossfade */
  crossfade: 0.3,
} as const

// ─── Easing Presets ────────────────────────────────────────────────

export const easings = {
  /** Apple-like deceleration */
  out: [0.16, 1, 0.3, 1] as const,
  /** Slight overshoot for kinetic feel */
  overshoot: [0.34, 1.56, 0.64, 1] as const,
}

// ─── Common Variants ───────────────────────────────────────────────

/** Fade up entrance — cards, sections */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

/** Fade in (no direction) — overlays, crossfade */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

/** Scale + fade — modals, dialogs */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
}

/** Slide from right — panels, drawers */
export const slideRight: Variants = {
  hidden: { x: "100%" },
  visible: { x: 0 },
  exit: { x: "100%" },
}

/** Page entrance — used by template.tsx */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
}

// ─── Stagger Helpers ───────────────────────────────────────────────

/** Container variant for staggered children */
export function staggerContainer(staggerMs = 50): Variants {
  return {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerMs / 1000,
        delayChildren: 0.05,
      },
    },
  }
}

/** Single child variant for use inside stagger container */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springs.gentle,
  },
}

// ─── Hover / Tap Presets ───────────────────────────────────────────

/** Card hover — subtle lift + scale */
export const cardHover = {
  whileHover: {
    y: -3,
    scale: 1.008,
    transition: { type: "spring" as const, stiffness: 400, damping: 25 },
  },
  whileTap: {
    scale: 0.985,
    transition: { type: "spring" as const, stiffness: 500, damping: 30 },
  },
}

/** Button press — snappy scale-down */
export const buttonTap = {
  whileTap: {
    scale: 0.97,
    transition: { type: "spring" as const, stiffness: 500, damping: 30 },
  },
}
