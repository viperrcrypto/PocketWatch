"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (date: string) => void
  min?: string // YYYY-MM-DD
  placeholder?: string
  required?: boolean
  className?: string
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function buildCells(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const cells: { day: number; trailing: boolean }[] = []

  if (firstDow > 0) {
    const prevDays = new Date(year, month, 0).getDate()
    for (let i = firstDow - 1; i >= 0; i--) {
      cells.push({ day: prevDays - i, trailing: true })
    }
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, trailing: false })

  const rem = 7 - (cells.length % 7)
  if (rem < 7) {
    for (let d = 1; d <= rem; d++) cells.push({ day: d, trailing: true })
  }
  return cells
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}` }

export function DatePicker({ value, onChange, min, placeholder = "Select date", required, className }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Parse value or default to current month
  const parsed = value ? new Date(value + "T00:00:00") : null
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? new Date().getMonth())

  const minDate = min ? new Date(min + "T00:00:00") : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const cells = useMemo(() => buildCells(viewYear, viewMonth), [viewYear, viewMonth])

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const goToPrev = useCallback(() => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }, [viewMonth])

  const goToNext = useCallback(() => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }, [viewMonth])

  const selectDate = useCallback((day: number) => {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
    onChange(dateStr)
    setOpen(false)
  }, [viewYear, viewMonth, onChange])

  // Close on outside click/touch
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("touchstart", handler, { passive: true })
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("touchstart", handler)
    }
  }, [open])

  // Sync view when value changes externally
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.getFullYear())
      setViewMonth(parsed.getMonth())
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayValue = parsed
    ? parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full bg-background border border-card-border rounded-lg px-3 py-2.5 min-h-[44px] text-sm text-left flex items-center gap-2 transition-colors",
          "focus:outline-none focus:border-primary hover:border-foreground-muted/40",
          open && "border-primary",
          displayValue ? "text-foreground" : "text-foreground-muted/50",
          className,
        )}
      >
        <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>calendar_today</span>
        <span className="flex-1 truncate">{displayValue ?? placeholder}</span>
      </button>

      {/* Hidden native input for form validation */}
      {required && <input type="text" value={value} required tabIndex={-1} className="sr-only" onChange={() => {}} />}

      {open && (
        <div className="absolute top-full mt-1.5 z-50 bg-card border border-card-border rounded-xl shadow-xl p-3 w-[300px] sm:w-[280px] right-0 sm:left-0 sm:right-auto animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Month nav — 44px touch targets */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={goToPrev} className="touch-target rounded-lg text-foreground-muted hover:text-foreground hover:bg-background transition-colors">
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_left</span>
            </button>
            <span className="text-xs font-bold text-foreground">{monthLabel}</span>
            <button type="button" onClick={goToNext} className="touch-target rounded-lg text-foreground-muted hover:text-foreground hover:bg-background transition-colors">
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>chevron_right</span>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-0.5">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-foreground-muted/60 uppercase tracking-wider py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid — min 44px cells on mobile */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, i) => {
              if (cell.trailing) {
                return (
                  <div key={i} className="aspect-square flex items-center justify-center min-h-[40px]">
                    <span className="text-xs text-foreground-muted/25">{cell.day}</span>
                  </div>
                )
              }

              const cellDate = new Date(viewYear, viewMonth, cell.day)
              const isPast = minDate ? cellDate < minDate : false
              const isToday = cellDate.getTime() === today.getTime()
              const isSelected = parsed && parsed.getTime() === cellDate.getTime()

              return (
                <button
                  key={i}
                  type="button"
                  disabled={isPast}
                  onClick={() => selectDate(cell.day)}
                  className={cn(
                    "aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-colors min-h-[40px]",
                    isPast && "text-foreground-muted/20 cursor-not-allowed",
                    !isPast && !isSelected && "text-foreground hover:bg-primary/10",
                    isToday && !isSelected && "ring-1 ring-inset ring-primary/40 text-primary font-bold",
                    isSelected && "bg-primary text-white font-bold",
                  )}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
