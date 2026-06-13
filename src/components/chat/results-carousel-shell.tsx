"use client"

import { useCallback, useRef, useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"
import { staggerContainer, staggerItem, easings, durations } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface ResultsCarouselShellProps {
  /** Pre-rendered option cards, in display order. */
  cards: ReactNode[]
  /** Index that gets the BorderBeam spotlight (the "best" option). */
  bestIndex: number
  /** Slot rendered as the BorderBeam (passed `radius`). Caller owns the accent. */
  renderBeam: () => ReactNode
  /** Accessible label for the whole region, e.g. "Flight options". */
  label: string
  /** Per-card width on mobile; cards are paged one at a time. */
  className?: string
}

/**
 * Horizontally paged carousel shell shared by the flight + hotel carousels.
 *
 * Picasso: staggered entrance (40-80ms via staggerContainer), scroll-snap paging,
 * prev/next + dots, ←/→ keyboard, "N of M" counter. Reduced motion drops the
 * stagger and uses instant scroll. Caps the visible stagger group at 8.
 */
export function ResultsCarouselShell({
  cards,
  bestIndex,
  renderBeam,
  label,
  className,
}: ResultsCarouselShellProps) {
  const reduce = useReducedMotion()
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const total = cards.length

  const scrollTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, total - 1))
      const track = trackRef.current
      if (!track) return
      const child = track.children[clamped] as HTMLElement | undefined
      if (child) {
        track.scrollTo({ left: child.offsetLeft - track.offsetLeft, behavior: reduce ? "auto" : "smooth" })
      }
      setActive(clamped)
    },
    [total, reduce]
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault()
        scrollTo(active + 1)
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        scrollTo(active - 1)
      }
    },
    [active, scrollTo]
  )

  // Keep `active` in sync when the user swipes/drags the track directly.
  const onScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const children = Array.from(track.children) as HTMLElement[]
    const center = track.scrollLeft + track.clientWidth / 2
    let nearest = 0
    let best = Infinity
    children.forEach((c, i) => {
      const mid = c.offsetLeft - track.offsetLeft + c.clientWidth / 2
      const d = Math.abs(mid - center)
      if (d < best) {
        best = d
        nearest = i
      }
    })
    setActive(nearest)
  }, [])

  const staggerCap = 8

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={onKeyDown}
      tabIndex={0}
      className="group/carousel relative rounded-2xl focus:outline-none focus-visible:outline-2 focus-visible:outline-primary"
    >
      <motion.div
        ref={trackRef}
        onScroll={onScroll}
        role="group"
        className={cn(
          "flex gap-3 overflow-x-auto scroll-smooth scrollbar-hide pb-1 snap-x snap-mandatory",
          className
        )}
        variants={reduce ? undefined : staggerContainer(60)}
        initial={reduce ? undefined : "hidden"}
        animate={reduce ? undefined : "visible"}
      >
        {cards.map((card, i) => {
          const isBest = i === bestIndex
          const inner = (
            <div className="relative h-full rounded-2xl">
              {isBest && renderBeam()}
              <div className="relative h-full">{card}</div>
            </div>
          )
          return (
            <motion.div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${total}`}
              className="snap-center shrink-0 w-[260px] sm:w-[300px]"
              variants={reduce || i >= staggerCap ? undefined : staggerItem}
              initial={reduce || i >= staggerCap ? false : undefined}
              animate={reduce || i >= staggerCap ? false : undefined}
            >
              {inner}
            </motion.div>
          )
        })}
      </motion.div>

      {/* Controls */}
      {total > 1 && (
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <CarouselArrow direction="prev" disabled={active === 0} onClick={() => scrollTo(active - 1)} />
            <CarouselArrow direction="next" disabled={active === total - 1} onClick={() => scrollTo(active + 1)} />
          </div>

          {/* Dots — cap at 8, then collapse */}
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Slides">
            {cards.slice(0, staggerCap).map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === active}
                aria-label={`Go to ${i + 1} of ${total}`}
                onClick={() => scrollTo(i)}
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color] duration-150",
                  i === active
                    ? "w-4 bg-primary"
                    : "w-1.5 bg-card-border hover:bg-card-border-hover"
                )}
                style={{ transitionTimingFunction: `cubic-bezier(${easings.out.join(",")})` }}
              />
            ))}
            {total > staggerCap && (
              <span className="text-[10px] text-foreground-muted ml-0.5">+{total - staggerCap}</span>
            )}
          </div>

          <span className="text-[11px] tabular-nums text-foreground-muted shrink-0">
            {active + 1} of {total}
          </span>
        </div>
      )}
    </section>
  )
}

function CarouselArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next"
  disabled: boolean
  onClick: () => void
}) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Previous" : "Next"}
      whileTap={reduce || disabled ? undefined : { scale: 0.92 }}
      transition={{ duration: durations.fast, ease: easings.overshoot }}
      className={cn(
        "flex items-center justify-center h-7 w-7 rounded-full border border-card-border bg-card text-foreground-muted",
        "transition-colors duration-100 hover:text-foreground hover:border-card-border-hover",
        "disabled:opacity-40 disabled:pointer-events-none"
      )}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
        {direction === "prev" ? "chevron_left" : "chevron_right"}
      </span>
    </motion.button>
  )
}
