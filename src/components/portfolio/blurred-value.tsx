"use client"

import { ReactNode } from "react"

interface BlurredValueProps {
  isHidden: boolean
  children: ReactNode
}

export function BlurredValue({ isHidden, children }: BlurredValueProps) {
  if (!isHidden) return <>{children}</>

  return (
    <span style={{ filter: "blur(8px)", userSelect: "none" }} aria-hidden="true">
      {children}
    </span>
  )
}
