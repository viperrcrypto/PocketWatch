"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { cn, formatCurrency } from "@/lib/utils"
import { computeNextChargeDate, type Frequency } from "@/lib/finance/subscriptions"

export interface BillItem {
  id: string
  merchantName: string
  amount: number
  frequency: string
  nextDueDate: string
  daysUntil: number
  category: string | null
}

interface BillsCalendarProps {
  bills: BillItem[]
  className?: string
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"]

/** Project a bill's next due date into a target month by advancing it forward by its frequency */
function projectBillsToMonth(bills: BillItem[], year: number, month: number): Map<number, BillItem[]> {
  const dayMap = new Map<number, BillItem[]>()

  for (const bill of bills) {
    let date = new Date(bill.nextDueDate)
    date.setHours(0, 0, 0, 0)

    // Advance date forward until it reaches or passes the target month
    let iterations = 0
    while ((date.getFullYear() < year || (date.getFullYear() === year && date.getMonth() < month)) && iterations < 24) {
      date = computeNextChargeDate(date, bill.frequency as Frequency)
      iterations++
    }

    // Also try going back if the date overshot (for bills that started ahead)
    if (date.getFullYear() > year || (date.getFullYear() === year && date.getMonth() > month)) {
      continue
    }

    if (date.getFullYear() === year && date.getMonth() === month) {
      const day = date.getDate()
      const existing = dayMap.get(day) ?? []
      dayMap.set(day, [...existing, bill])
    }
  }

  return dayMap
}

function buildCalendarCells(year: number, month: number): Array<{ day: number | null }> {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const cells: Array<{ day: number | null }> = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push({ day: null })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d })
  return cells
}

function isWithinNextWeek(day: number, year: number, month: number): boolean {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(year, month, day)
  const diff = target.getTime() - now.getTime()
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000
}

export function BillsCalendar({ bills = [], className }: BillsCalendarProps) {
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()
  const today = isCurrentMonth ? now.getDate() : -1

  const billsByDay = useMemo(
    () => projectBillsToMonth(bills, viewYear, viewMonth),
    [bills, viewYear, viewMonth]
  )

  const cells = useMemo(
    () => buildCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  )

  // Close popover on click outside or Escape
  useEffect(() => {
    if (selectedDay === null) return
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSelectedDay(null)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedDay(null)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [selectedDay])

  const goToPrevMonth = useCallback(() => {
    setSelectedDay(null)
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }, [viewMonth, viewYear])

  const goToNextMonth = useCallback(() => {
    setSelectedDay(null)
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }, [viewMonth, viewYear])

  const goToToday = useCallback(() => {
    setSelectedDay(null)
    setViewMonth(now.getMonth())
    setViewYear(now.getFullYear())
  }, [now])

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })

  return (
    <div className={cn("relative", className)}>
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goToPrevMonth}
          className="p-1 rounded-md text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>chevron_left</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{monthLabel}</span>
          {!isCurrentMonth && (
            <button
              onClick={goToToday}
              className="text-[9px] font-medium text-primary hover:text-primary-hover transition-colors"
            >
              Today
            </button>
          )}
        </div>
        <button
          onClick={goToNextMonth}
          className="p-1 rounded-md text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>chevron_right</span>
        </button>
      </div>

      {/* Day Labels */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-[9px] font-medium text-foreground-muted pb-1">
            {label}
          </div>
        ))}

        {/* Calendar Cells */}
        {cells.map((cell, i) => {
          if (cell.day === null) return <div key={i} />

          const dayBills = billsByDay.get(cell.day)
          const hasBills = !!dayBills && dayBills.length > 0
          const isToday = cell.day === today
          const isUpcoming = isWithinNextWeek(cell.day, viewYear, viewMonth)
          const isSelected = cell.day === selectedDay
          const isHovered = cell.day === hoveredDay

          // Urgency for bill days
          const nowMs = now.getTime()
          const cellDate = new Date(viewYear, viewMonth, cell.day)
          const daysUntil = Math.ceil((cellDate.getTime() - nowMs) / (1000 * 60 * 60 * 24))
          const isUrgent = hasBills && daysUntil >= 0 && daysUntil <= 3
          const isSoon = hasBills && daysUntil > 3 && daysUntil <= 7

          return (
            <div key={i} className="relative">
              <button
                type="button"
                onClick={() => hasBills ? setSelectedDay(isSelected ? null : cell.day) : setSelectedDay(null)}
                onMouseEnter={() => hasBills ? setHoveredDay(cell.day) : undefined}
                onMouseLeave={() => setHoveredDay(null)}
                className={cn(
                  "w-full aspect-square flex items-center justify-center rounded-lg text-[11px] font-medium transition-all relative",
                  // Base styles
                  !hasBills && !isToday && "text-foreground-muted",
                  // Upcoming week subtle highlight
                  isUpcoming && !hasBills && !isToday && "bg-primary/5",
                  // Today
                  isToday && !hasBills && "bg-primary/10 text-primary font-bold",
                  isToday && hasBills && "ring-2 ring-primary",
                  // Bill days
                  hasBills && !isUrgent && !isSoon && "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
                  isSoon && "bg-amber-50 text-amber-700 ring-1 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
                  isUrgent && "bg-red-50 text-red-700 ring-1 ring-red-300 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30",
                  // Selected
                  isSelected && "ring-2 ring-primary shadow-sm",
                  // Hover
                  hasBills && "cursor-pointer hover:shadow-sm",
                )}
              >
                {cell.day}
                {hasBills && dayBills.length > 1 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center">
                    {dayBills.length}
                  </span>
                )}
              </button>

              {/* Hover Tooltip */}
              {isHovered && !isSelected && hasBills && dayBills && (
                <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1.5 pointer-events-none">
                  <div className="bg-foreground text-background rounded-lg px-2.5 py-1.5 text-[10px] whitespace-nowrap shadow-lg">
                    {dayBills.length === 1 ? (
                      <span>{dayBills[0].merchantName} · {formatCurrency(dayBills[0].amount)}</span>
                    ) : (
                      <span>{dayBills.length} bills · {formatCurrency(dayBills.reduce((s, b) => s + b.amount, 0))}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Click Popover */}
              {isSelected && hasBills && dayBills && (
                <div
                  ref={popoverRef}
                  className={cn(
                    "absolute z-40 left-1/2 -translate-x-1/2 w-56",
                    // Position above if in last 2 rows, below otherwise
                    i >= cells.length - 14 ? "bottom-full mb-2" : "top-full mt-2"
                  )}
                >
                  <div className="bg-card border border-card-border rounded-xl shadow-xl p-3 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-foreground">
                        {new Date(viewYear, viewMonth, cell.day).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" · "}
                        {dayBills.length} bill{dayBills.length > 1 ? "s" : ""}
                      </span>
                      <button onClick={() => setSelectedDay(null)} className="text-foreground-muted hover:text-foreground">
                        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>close</span>
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {dayBills.map((bill) => (
                        <div key={bill.id} className="flex items-center justify-between">
                          <span className="text-[11px] text-foreground truncate mr-2">{bill.merchantName}</span>
                          <span className="font-data text-[11px] font-medium text-foreground tabular-nums flex-shrink-0">
                            {formatCurrency(bill.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {dayBills.length > 1 && (
                      <div className="mt-2 pt-2 border-t border-card-border flex justify-between">
                        <span className="text-[10px] text-foreground-muted">Total</span>
                        <span className="font-data text-[11px] font-semibold text-foreground tabular-nums">
                          {formatCurrency(dayBills.reduce((s, b) => s + b.amount, 0))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
