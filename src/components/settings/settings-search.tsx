"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { SETTINGS_SECTIONS, SETTINGS_TABS, type SettingsTabId } from "./settings-constants"

interface SettingsSearchProps {
  onNavigate: (tab: SettingsTabId, sectionId: string) => void
}

export function SettingsSearch({ onNavigate }: SettingsSearchProps) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return []
    return SETTINGS_SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.keywords.some((k) => k.includes(q))
    )
  }, [query])

  useEffect(() => {
    setActiveIndex(0)
  }, [results.length])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectResult = (index: number) => {
    const result = results[index]
    if (!result) return
    onNavigate(result.tab as SettingsTabId, result.id)
    setQuery("")
    setIsOpen(false)
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      selectResult(activeIndex)
    } else if (e.key === "Escape") {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  const tabLabel = (tabId: string) =>
    SETTINGS_TABS.find((t) => t.id === tabId)?.label ?? tabId

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-card-border focus-within:border-card-border-hover transition-colors">
        <span className="material-symbols-rounded text-foreground-muted flex-shrink-0" style={{ fontSize: 16 }}>search</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
          onFocus={() => query && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search settings..."
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-foreground placeholder-foreground-muted text-sm"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setIsOpen(false) }}
            className="text-foreground-muted hover:text-foreground transition-colors flex-shrink-0"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>close</span>
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-card-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {results.map((result, i) => (
            <button
              key={result.id}
              onClick={() => selectResult(i)}
              className={cn(
                "w-full px-3 py-2.5 flex items-center justify-between text-left transition-colors",
                i === activeIndex
                  ? "bg-background-secondary"
                  : "hover:bg-background-secondary/50"
              )}
            >
              <span className="text-sm text-foreground">{result.title}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-background-secondary text-foreground-muted">
                {tabLabel(result.tab)}
              </span>
            </button>
          ))}
        </div>
      )}

      {isOpen && query && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-card-border rounded-lg shadow-lg z-50 px-3 py-3 text-sm text-foreground-muted text-center">
          No settings found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  )
}
