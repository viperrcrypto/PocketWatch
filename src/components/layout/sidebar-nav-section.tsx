"use client"

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

  return (
    <LayoutGroup id={`nav-${label.replace(/\s+/g, "-")}`}>
      {label && (
        <div className="px-3 mb-3">
          <p className="text-[10px] font-semibold tracking-widest text-foreground-muted uppercase">
            {label}
          </p>
        </div>
      )}

      {items.map((item) => {
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
            {/* Animated active background — layout animation slides between items */}
            {isActive && (
              reduce ? (
                <span className="absolute inset-0 bg-primary-muted rounded-lg" style={{ zIndex: -1 }} />
              ) : (
                <motion.span
                  layoutId={`nav-active-${label.replace(/\s+/g, "-")}`}
                  className="absolute inset-0 bg-primary-muted rounded-lg"
                  transition={springs.snappy}
                  style={{ zIndex: -1 }}
                />
              )
            )}
            {/* Animated left indicator bar */}
            {reduce ? (
              isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full -ml-1" />
            ) : (
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
            )}
            <span
              className={cn("material-symbols-rounded text-[18px] flex-shrink-0", isActive && "filled")}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
            {badges?.[item.id] != null && badges[item.id] > 0 && (
              reduce ? (
                <span className="ml-auto w-5 h-5 rounded-full bg-error/90 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {badges[item.id] > 9 ? "9+" : badges[item.id]}
                </span>
              ) : (
                <motion.span
                  className="ml-auto w-5 h-5 rounded-full bg-error/90 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={springs.bouncy}
                >
                  {badges[item.id] > 9 ? "9+" : badges[item.id]}
                </motion.span>
              )
            )}
          </Link>
        )
      })}
    </LayoutGroup>
  )
}
