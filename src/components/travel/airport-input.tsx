"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useAirportSearch } from "@/hooks/travel/use-airport-search"
import { AIRPORT_BY_IATA } from "@/lib/travel/airport-data"
import type { Airport } from "@/lib/travel/airport-types"

interface AirportInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}

export function AirportInput({ value, onChange, placeholder = "City or airport code", required }: AirportInputProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedCodes = useMemo(
    () => value.split(",").map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]{3}$/.test(s)),
    [value],
  )

  const results = useAirportSearch(query, selectedCodes)

  // Reset highlight when results change
  useEffect(() => { setHighlightIndex(0) }, [results])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const addCode = useCallback((code: string) => {
    const next = selectedCodes.includes(code) ? selectedCodes : [...selectedCodes, code]
    onChange(next.join(","))
    setQuery("")
    setOpen(false)
    inputRef.current?.focus()
  }, [selectedCodes, onChange])

  const removeCode = useCallback((code: string) => {
    const next = selectedCodes.filter(c => c !== code)
    onChange(next.join(","))
    inputRef.current?.focus()
  }, [selectedCodes, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex(i => Math.max(i - 1, 0))
    } else if (e.key === "Enter" || (e.key === "Tab" && open && results.length > 0)) {
      e.preventDefault()
      if (open && results.length > 0) {
        addCode(results[highlightIndex]!.iata)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
      setQuery("")
    } else if (e.key === "Backspace" && query === "" && selectedCodes.length > 0) {
      removeCode(selectedCodes[selectedCodes.length - 1]!)
    }
  }, [open, results, highlightIndex, query, selectedCodes, addCode, removeCode])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setOpen(val.length > 0)
  }, [])

  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div ref={containerRef} className="relative">
      {/* Main input area — fixed height, horizontal scroll */}
      <div
        onClick={handleContainerClick}
        className={cn(
          "w-full h-[38px] bg-background border border-foreground/15 rounded-lg px-2 shadow-sm",
          "flex items-center gap-1.5 cursor-text transition-colors overflow-x-auto overflow-y-hidden",
          "focus-within:border-primary focus-within:shadow-none",
          "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
        )}
      >
        {/* Selected airport chips — compact, code only */}
        {selectedCodes.map(code => (
          <span
            key={code}
            className="inline-flex items-center shrink-0 gap-0.5 pl-1.5 pr-0.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono font-bold"
            title={AIRPORT_BY_IATA.get(code)?.city}
          >
            {code}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeCode(code) }}
              className="text-primary/40 hover:text-primary transition-colors"
              aria-label={`Remove ${code}`}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 13 }}>close</span>
            </button>
          </span>
        ))}

        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (query.length > 0) setOpen(true) }}
          placeholder={selectedCodes.length === 0 ? placeholder : "+"}
          className="flex-1 min-w-[60px] bg-transparent text-sm text-foreground placeholder:text-foreground-muted/50 focus:outline-none"
        />
      </div>

      {/* Hidden input for form validation */}
      {required && (
        <input type="text" value={value} required tabIndex={-1} className="sr-only" onChange={() => {}} />
      )}

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-card-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {results.map((airport, i) => (
            <AirportRow
              key={airport.iata}
              airport={airport}
              highlighted={i === highlightIndex}
              onSelect={() => addCode(airport.iata)}
              onHover={() => setHighlightIndex(i)}
            />
          ))}
        </div>
      )}

      {/* No results */}
      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-card-border rounded-xl shadow-xl p-3 text-xs text-foreground-muted text-center animate-in fade-in slide-in-from-top-1 duration-150">
          No airports found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  )
}

function AirportRow({
  airport,
  highlighted,
  onSelect,
  onHover,
}: {
  airport: Airport
  highlighted: boolean
  onSelect: () => void
  onHover: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        "w-full px-3 py-2 flex items-center gap-3 text-left text-sm transition-colors",
        highlighted ? "bg-primary/10" : "hover:bg-background",
      )}
    >
      <span className="font-mono font-bold text-primary w-9 shrink-0">{airport.iata}</span>
      <span className="flex-1 min-w-0 truncate text-foreground">
        {airport.city}
        <span className="text-foreground-muted ml-1.5">— {airport.name}</span>
      </span>
      <span className="text-[11px] text-foreground-muted/60 shrink-0">{airport.country}</span>
      {highlighted && (
        <span className="ml-1 shrink-0 rounded border border-foreground/10 bg-background px-1 py-px text-[10px] font-medium text-foreground-muted/50">
          Tab
        </span>
      )}
    </button>
  )
}
