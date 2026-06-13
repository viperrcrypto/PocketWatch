"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { springs } from "@/lib/motion"
import type { NavItem } from "@/hooks/use-sidebar-prefs"

interface SidebarNavSectionProps {
  label: string
  items: NavItem[]
  pathname: string
  baseHref: string
  onClose?: () => void
  badges?: Record<string, number>
}

export function SidebarNavSection({ label, items, pathname, baseHref, onClose, badges }: SidebarNavSectionProps) {
  const reduce = useReducedMotion()
  // Defer motion rendering until after hydration to prevent server/client mismatch
  // (useReducedMotion + LayoutGroup behave differently during SSR)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const useMotion = mounted && !reduce

  const groupId = `nav-${label.replace(/\s+/g, "-")}`

  const labelEl = label ? (
    <div className="px-3 mb-3">
      <p className="text-[10px] font-semibold tracking-widest text-foreground-muted uppercase">
        {label}
      </p>
    </div>
  ) : null

  const navItems = items.map((item) => {
    const isActive =
      pathname === item.href ||
      (item.href !== baseHref && pathname.startsWith(item.href))

    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={onClose}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "text-primary"
            : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
        )}
      >
        {/* Active background */}
        {isActive && (
          useMotion ? (
            <motion.span
              layoutId={`nav-active-${groupId}`}
              className="absolute inset-0 bg-primary-muted rounded-lg"
              transition={springs.snappy}
              style={{
                zIndex: -1,
                boxShadow:
                  "inset 0 0 0 1px color-mix(in srgb, var(--primary) 22%, transparent), 0 2px 10px -4px color-mix(in srgb, var(--primary) 40%, transparent)",
              }}
            />
          ) : (
            <span
              className="absolute inset-0 bg-primary-muted rounded-lg"
              style={{
                zIndex: -1,
                boxShadow:
                  "inset 0 0 0 1px color-mix(in srgb, var(--primary) 22%, transparent), 0 2px 10px -4px color-mix(in srgb, var(--primary) 40%, transparent)",
              }}
            />
          )
        )}
        {/* Left indicator bar */}
        {useMotion ? (
          <AnimatePresence>
            {isActive && (
              <motion.span
                className="absolute left-0 top-1/2 w-0.5 bg-primary rounded-full -ml-1"
                initial={{ height: 0, y: "-50%" }}
                animate={{ height: 16, y: "-50%" }}
                exit={{ height: 0, y: "-50%" }}
                transition={springs.snappy}
              />
            )}
          </AnimatePresence>
        ) : (
          isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full -ml-1" />
        )}
        <span
          className={cn("material-symbols-rounded text-[18px] flex-shrink-0", isActive && "filled")}
          aria-hidden="true"
        >
          {item.icon}
        </span>
        <span>{item.label}</span>
        {badges?.[item.id] != null && badges[item.id] > 0 && (
          useMotion ? (
            <motion.span
              className="ml-auto w-5 h-5 rounded-full bg-error/90 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={springs.bouncy}
            >
              {badges[item.id] > 9 ? "9+" : badges[item.id]}
            </motion.span>
          ) : (
            <span className="ml-auto w-5 h-5 rounded-full bg-error/90 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
              {badges[item.id] > 9 ? "9+" : badges[item.id]}
            </span>
          )
        )}
      </Link>
    )
  })

  // LayoutGroup only after hydration — prevents SSR mismatch
  if (useMotion) {
    return <LayoutGroup id={groupId}>{labelEl}{navItems}</LayoutGroup>
  }
  return <>{labelEl}{navItems}</>
}
