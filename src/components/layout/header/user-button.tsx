"use client"

import { useState, useEffect, useRef } from "react"
import { useProfile } from "@/hooks/use-api"

export function UserButton() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { data: profileData } = useProfile()
  const user = profileData?.user

  const handleLogout = async () => {
    setIsOpen(false)
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // Best-effort
    }
    window.location.href = "/"
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (!user) return null

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-card border border-card-border rounded-lg hover:border-card-border-hover transition-colors min-h-[44px]"
      >
        <span className="material-symbols-rounded text-base text-foreground-muted">person</span>
        <span className="text-sm font-data text-foreground">
          {user.displayName || user.username}
        </span>
        <span className="material-symbols-rounded text-sm text-foreground-muted">
          {isOpen ? "expand_less" : "expand_more"}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-card-border rounded-xl shadow-lg z-50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-error hover:bg-error-muted transition-colors text-left rounded-xl"
          >
            <span className="material-symbols-rounded text-base">logout</span>
            Log Out
          </button>
        </div>
      )}
    </div>
  )
}
