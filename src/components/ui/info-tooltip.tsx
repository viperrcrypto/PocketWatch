"use client"

import * as Tooltip from "@radix-ui/react-tooltip"

interface InfoTooltipProps {
  content: string
  children?: React.ReactNode
}

export function InfoTooltip({ content, children }: InfoTooltipProps) {
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {children || (
            <button
              type="button"
              className="inline-flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors"
            >
              <span className="material-symbols-rounded text-base">info</span>
            </button>
          )}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            className="max-w-xs px-3 py-2 bg-card border border-card-border text-sm text-foreground shadow-lg z-50"
            sideOffset={5}
          >
            {content}
            <Tooltip.Arrow className="fill-card-border" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
