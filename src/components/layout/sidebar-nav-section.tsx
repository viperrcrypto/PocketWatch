"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import type { NavItem } from "@/hooks/use-sidebar-prefs"

interface SidebarNavSectionProps {
  label: string
  items: NavItem[]
  pathname: string
  baseHref: string
  onClose?: () => void
}

export function SidebarNavSection({ label, items, pathname, baseHref, onClose }: SidebarNavSectionProps) {
  return (
    <>
      <div className="px-3 mb-3">
        <p className="text-[10px] font-semibold tracking-widest text-foreground-muted uppercase">
          {label}
        </p>
      </div>

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
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "text-primary bg-primary-muted"
                : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
            )}
          >
            <span
              className={cn("material-symbols-rounded text-lg", isActive && "filled")}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        )
      })}
    </>
  )
}
