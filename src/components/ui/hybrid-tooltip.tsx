"use client"

import * as Tooltip from "@radix-ui/react-tooltip"
import * as Popover from "@radix-ui/react-popover"
import { useIsTouchDevice } from "@/hooks/use-touch-device"
import { cn } from "@/lib/utils"

interface HybridTooltipProps {
  content: string | React.ReactNode
  children?: React.ReactNode
  /** Side preference for the popover/tooltip */
  side?: "top" | "bottom" | "left" | "right"
  /** Additional class for the content panel */
  contentClassName?: string
}

/**
 * Desktop: Radix Tooltip (hover to show, blur to hide)
 * Mobile/touch: Radix Popover (tap to show, tap outside to dismiss)
 *
 * Research-backed toggletip pattern per Apple HIG, Radix maintainers,
 * and inclusive-components.design.
 */
export function HybridTooltip({
  content,
  children,
  side = "top",
  contentClassName,
}: HybridTooltipProps) {
  const isTouch = useIsTouchDevice()

  const trigger = children || (
    <button
      type="button"
      className="touch-target inline-flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors"
      aria-label="More info"
    >
      <span className="material-symbols-rounded text-base">info</span>
    </button>
  )

  const contentClasses = cn(
    "max-w-xs px-3 py-2 bg-card border border-card-border text-sm text-foreground rounded-lg shadow-lg z-[60]",
    contentClassName,
  )

  // Touch devices: Radix Popover (tap-to-toggle)
  if (isTouch) {
    return (
      <Popover.Root>
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side={side}
            sideOffset={5}
            className={cn(contentClasses, "animate-in fade-in slide-in-from-top-1 duration-150")}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {content}
            <Popover.Arrow className="fill-card-border" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  // Desktop: Radix Tooltip (hover)
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{trigger}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content side={side} className={contentClasses} sideOffset={5}>
            {content}
            <Tooltip.Arrow className="fill-card-border" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
