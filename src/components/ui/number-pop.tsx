"use client"

import { useEffect, useRef, useState } from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import { cn } from "@/lib/utils"

interface NumberPopProps {
  /** The current numeric value. Counts + pops whenever this changes. */
  value: number
  /** Format the displayed number (e.g. currency). Default `toLocaleString`. */
  format?: (n: number) => string
  /** Count-up duration in seconds (default 0.6). */
  duration?: number
  /** Scale at the peak of the pop (default 1.06). */
  popScale?: number
  className?: string
}

/**
 * Animated number that counts to its new value and "pops" (quick scale) on
 * change — for net-worth and other big figures. Always tabular-nums so digits
 * don't reflow. Reduced-motion shows the final value instantly with no pop.
 *
 * The pop is a TWEEN on a motion value (not a spring with 3 keyframes — motion
 * only allows 2 keyframes with springs), and the element shape is identical in
 * both branches so SSR + reduced-motion never hydration-mismatch.
 *
 * @example <NumberPop value={netWorth} format={(n) => formatCurrency(n)} />
 */
export function NumberPop({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  duration = 0.6,
  popScale = 1.06,
  className,
}: NumberPopProps) {
  const reduce = useReducedMotion()
  const count = useMotionValue(value)
  const scale = useMotionValue(1)
  // Hold the formatter in a ref so inline arrow callers don't restart the
  // count-up on every parent re-render.
  const formatRef = useRef(format)
  formatRef.current = format
  const display = useTransform(count, (n) => formatRef.current(n))
  const [text, setText] = useState(() => format(value))

  useEffect(() => display.on("change", setText), [display])

  useEffect(() => {
    if (reduce) {
      count.jump(value)
      setText(formatRef.current(value))
      return
    }
    const counting = animate(count, value, { duration, ease: [0.16, 1, 0.3, 1] })
    const popping = animate(scale, [1, popScale, 1], {
      duration: 0.32,
      ease: [0.34, 1.56, 0.64, 1],
      times: [0, 0.4, 1],
    })
    return () => {
      counting.stop()
      popping.stop()
    }
  }, [value, reduce, duration, popScale, count, scale])

  return (
    <motion.span
      className={cn("inline-block tabular-nums", className)}
      style={{ scale: reduce ? 1 : scale }}
    >
      {reduce ? format(value) : text}
    </motion.span>
  )
}
