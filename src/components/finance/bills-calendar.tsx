"use client"

import { useState, useMemo, useCallback } from "react"
import { cn, formatCurrency } from "@/lib/utils"
import {
  freqDotColor, projectBillsToMonth, buildCalendarCells,
} from "./bills-calendar-helpers"
import { BillAvatar } from "./bill-avatar"
import { getCancelUrl } from "@/lib/finance/cancel-links"

export interface BillItem {
  id: string
  merchantName: string
  amount: number
  frequency: string
  nextDueDate: string
  daysUntil: number
  category: string | null
  isPaid?: boolean
  logoUrl?: string | null
  accountName?: string | null
  accountMask?: string | null
  institutionName?: string | null
}

interface BillsCalendarProps {
  bills: BillItem[]
  className?: string
  onSelectBill?: (bill: BillItem) => void
  onMonthChange?: (year: number, month: number) => void
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function BillsCalendar({ bills = [], className, onSelectBill, onMonthChange }: BillsCalendarProps) {
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()
  const today = isCurrentMonth ? now.getDate() : -1

  const billsByDay = useMemo(() => projectBillsToMonth(bills, viewYear, viewMonth), [bills, viewYear, viewMonth])
  const cells = useMemo(() => buildCalendarCells(viewYear, viewMonth), [viewYear, viewMonth])

  const monthTotal = useMemo(() => {
    let total = 0
    for (const dayBills of billsByDay.values()) for (const b of dayBills) total += b.amount
    return total
  }, [billsByDay])

  const billCount = useMemo(() => {
    let count = 0
    for (const dayBills of billsByDay.values()) count += dayBills.length
    return count
  }, [billsByDay])

  const goToPrevMonth = useCallback(() => {
    setSelectedDay(null)
    const newYear = viewMonth === 0 ? viewYear - 1 : viewYear
    const newMonth = viewMonth === 0 ? 11 : viewMonth - 1
    setViewMonth(newMonth)
    setViewYear(newYear)
    onMonthChange?.(newYear, newMonth)
  }, [viewMonth, viewYear, onMonthChange])

  const goToNextMonth = useCallback(() => {
    setSelectedDay(null)
    const newYear = viewMonth === 11 ? viewYear + 1 : viewYear
    const newMonth = viewMonth === 11 ? 0 : viewMonth + 1
    setViewMonth(newMonth)
    setViewYear(newYear)
    onMonthChange?.(newYear, newMonth)
  }, [viewMonth, viewYear, onMonthChange])

  const goToToday = useCallback(() => {
    setSelectedDay(null)
    const todayMonth = now.getMonth()
    const todayYear = now.getFullYear()
    setViewMonth(todayMonth)
    setViewYear(todayYear)
    onMonthChange?.(todayYear, todayMonth)
  }, [now, onMonthChange])

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-foreground tracking-tight">{monthLabel}</h4>
        <div className="flex items-center gap-1.5">
          {!isCurrentMonth && (
            <button
              onClick={goToToday}
              className="px-2.5 py-1 text-[10px] font-semibold text-primary bg-primary-muted rounded-full hover:bg-primary/15 transition-colors"
            >
              Today
            </button>
          )}
          <button onClick={goToPrevMonth} className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors">
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>chevron_left</span>
          </button>
          <button onClick={goToNextMonth} className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors">
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>chevron_right</span>
          </button>
        </div>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[9px] font-semibold text-foreground-muted/60 uppercase tracking-wider py-1">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-card-border/20 rounded-lg overflow-hidden">
        {cells.map((cell, i) => {
          if (cell.isTrailing) {
            return (
              <div key={i} className="bg-card/30 aspect-square p-1 flex items-start">
                <span className="text-[10px] text-foreground-muted/50 font-medium">{cell.day}</span>
              </div>
            )
          }

          const dayBills = billsByDay.get(cell.day!)
          const hasBills = !!dayBills && dayBills.length > 0
          const isToday = cell.day === today
          const isSelected = cell.day === selectedDay

          return (
            <button
              key={i}
              type="button"
              onClick={() => hasBills ? setSelectedDay(isSelected ? null : cell.day) : setSelectedDay(null)}
              className={cn(
                "aspect-square p-1 flex flex-col items-center transition-all relative",
                "bg-card/50 hover:bg-card/80",
                isToday && "ring-1.5 ring-inset ring-primary/50 bg-primary-subtle",
                isSelected && hasBills && "ring-2 ring-inset ring-primary bg-primary-muted",
                hasBills && "cursor-pointer",
              )}
            >
              <span className={cn(
                "text-[10px] font-medium leading-none self-start",
                isToday ? "text-primary font-bold" : "text-foreground-muted",
              )}>
                {cell.day}
              </span>

              {hasBills && (
                <div className="flex-1 flex items-center justify-center w-full">
                  {dayBills.length === 1 ? (
                    <BillAvatar merchantName={dayBills[0].merchantName} logoUrl={dayBills[0].logoUrl} size="md" />
                  ) : (
                    <div className="flex -space-x-1.5">
                      {dayBills.slice(0, 3).map((bill) => (
                        <BillAvatar key={bill.id} merchantName={bill.merchantName} logoUrl={bill.logoUrl} size="sm" className="ring-1 ring-card/80" />
                      ))}
                      {dayBills.length > 3 && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center bg-foreground-muted/20 ring-1 ring-card/80">
                          <span className="text-[7px] font-bold text-foreground-muted leading-none">+{dayBills.length - 3}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {hasBills && (
                <div className="absolute top-1 right-1 flex gap-px">
                  {dayBills.slice(0, 3).map((bill) => (
                    <span key={bill.id} className={cn("w-1 h-1 rounded-full", freqDotColor(bill.frequency))} />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day detail */}
      <SelectedDayPanel
        selectedDay={selectedDay}
        billsByDay={billsByDay}
        viewYear={viewYear}
        viewMonth={viewMonth}
        onClose={() => setSelectedDay(null)}
        onSelectBill={onSelectBill}
      />

      {/* Bottom stats bar */}
      <div className="mt-3 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-3">
          <Legend color="bg-blue-400" label="Monthly" />
          <Legend color="bg-amber-400" label="Quarterly" />
          <Legend color="bg-rose-400" label="Yearly" />
        </div>
        <div className="flex items-center gap-3 text-foreground-muted">
          <span>{billCount} bill{billCount !== 1 ? "s" : ""}</span>
          <span className="font-data font-semibold text-foreground tabular-nums">{formatCurrency(monthTotal)}</span>
        </div>
      </div>
    </div>
  )
}

function SelectedDayPanel({ selectedDay, billsByDay, viewYear, viewMonth, onClose, onSelectBill }: {
  selectedDay: number | null
  billsByDay: Map<number, BillItem[]>
  viewYear: number
  viewMonth: number
  onClose: () => void
  onSelectBill?: (bill: BillItem) => void
}) {
  if (selectedDay === null || !billsByDay.has(selectedDay)) return null
  const dayBills = billsByDay.get(selectedDay)!

  return (
    <div className="mt-3 bg-card/80 border border-card-border/50 rounded-xl p-3 animate-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold text-foreground">
          {new Date(viewYear, viewMonth, selectedDay).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </span>
        <button onClick={onClose} className="p-0.5 rounded text-foreground-muted hover:text-foreground transition-colors">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>close</span>
        </button>
      </div>
      <div className="space-y-2">
        {dayBills.map((bill) => {
          const cancelInfo = !bill.isPaid ? getCancelUrl(bill.merchantName) : null
          return (
            <div
              key={bill.id}
              className={cn(
                bill.isPaid && "opacity-50",
                onSelectBill && "cursor-pointer hover:bg-background-secondary/50 rounded-lg transition-colors -mx-1 px-1",
              )}
              onClick={() => onSelectBill?.(bill)}
            >
              <div className="flex items-center gap-2.5">
                <BillAvatar merchantName={bill.merchantName} logoUrl={bill.logoUrl} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-foreground truncate">{bill.merchantName}</span>
                    {bill.isPaid && <span className="text-[8px] font-semibold text-success uppercase">Paid</span>}
                  </div>
                  <span className="text-[9px] text-foreground-muted capitalize">{bill.frequency.replace("_", " ")}</span>
                </div>
                <span className="font-data text-[11px] font-semibold text-foreground tabular-nums flex-shrink-0">
                  {formatCurrency(bill.amount)}
                </span>
              </div>
              {cancelInfo && (
                <a
                  href={cancelInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 ml-9.5 mt-1 px-2 py-0.5 text-[9px] font-medium text-primary hover:bg-primary-muted rounded transition-colors w-fit"
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 11 }}>open_in_new</span>
                  Cancel Now
                </a>
              )}
            </div>
          )
        })}
      </div>
      {dayBills.length > 1 && (
        <div className="mt-2 pt-2 border-t border-card-border/30 flex justify-between items-center">
          <span className="text-[10px] text-foreground-muted">Day Total</span>
          <span className="font-data text-[11px] font-semibold text-foreground tabular-nums">
            {formatCurrency(dayBills.reduce((s, b) => s + b.amount, 0))}
          </span>
        </div>
      )}
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={cn("w-1.5 h-1.5 rounded-full", color)} />
      <span className="text-foreground-muted">{label}</span>
    </div>
  )
}
