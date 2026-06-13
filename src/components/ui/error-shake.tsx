"use client"

import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

interface ErrorShakeProps {
  children: React.ReactNode
  className?: string
  /**
   * A counter or changing token. Each change (re)triggers one shake — pass
   * something like the submit attempt count, or a validation-error timestamp.
   */
  trigger: number | string | boolean
}

/**
 * Wraps an invalid input (or any element) and shakes it horizontally once
 * whenever `trigger` changes — for rejected form submits / validation errors.
 * Uses the `.animate-error-shake` cubic-bezier keyframe; reduced-motion is a
 * no-op (the global rule collapses the animation and we skip re-applying it).
 *
 * @example <ErrorShake trigger={attemptCount}><input aria-invalid /></ErrorShake>
 */
export function ErrorShake({ children, className, trigger }: ErrorShakeProps) {
  const reduce = useReducedMotion()
  const [shaking, setShaking] = useState(false)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (reduce) return
    setShaking(true)
    const t = setTimeout(() => setShaking(false), 400)
    return () => clearTimeout(t)
  }, [trigger, reduce])

  return (
    <div className={cn(shaking && "animate-error-shake", className)}>
      {children}
    </div>
  )
}
