"use client"

import { useState, useRef, useEffect } from "react"
import { cn, formatCurrency } from "@/lib/utils"
import { MerchantIcon } from "@/components/finance/merchant-icon"
import { getBillingUrgency } from "@/components/finance/subscription-card-helpers"
import { SubscriptionCardActions } from "@/components/finance/subscription-card-actions"
import { SubscriptionCardTransactions } from "@/components/finance/subscription-card-transactions"
import { SubscriptionLinkedProof } from "@/components/finance/subscription-linked-proof"

interface RecentTransaction {
  amount: number
  date: string
  name: string
}

interface LinkedTransaction {
  id: string
  name: string
  merchantName: string | null
  amount: number
  date: string
  accountName: string | null
  accountMask: string | null
  institutionName: string | null
  category: string | null
}

interface SubscriptionCardProps {
  id: string
  merchantName: string
  nickname: string | null
  amount: number
  frequency: string
  status: string
  isWanted: boolean
  nextChargeDate: string | null
  category?: string | null
  logoUrl?: string | null
  detectionMethod?: "auto" | "verified" | "manual"
  averageAmount?: number | null
  accountName?: string | null
  accountMask?: string | null
  accountType?: string | null
  institutionName?: string | null
  recentTransactions?: RecentTransaction[]
  linkedTransaction?: LinkedTransaction | null
  cancelReminderDate?: string | null
  onUpdateStatus?: (id: string, status: string) => void
  onToggleWanted?: (id: string, isWanted: boolean) => void
  onRequestCancel?: (sub: { id: string; merchantName: string; amount: number; frequency: string }) => void
  onUpdateNickname?: (id: string, nickname: string | null) => void
  onUpdateFrequency?: (id: string, frequency: string) => void
  onUpdateCategory?: (id: string, category: string | null) => void
  onSetReminder?: (id: string, date: string | null) => void
  onDismiss?: (id: string) => void
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-Annual",
  yearly: "Yearly",
}

const FREQUENCY_COLORS: Record<string, string> = {
  weekly: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
  biweekly: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
  monthly: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  quarterly: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  semi_annual: "bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400",
  yearly: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
}

const DETECTION_LABELS: Record<string, { text: string; color: string }> = {
  verified: { text: "Verified", color: "text-success" },
  auto: { text: "Auto-detected", color: "text-foreground-muted" },
}

const FREQUENCY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-Annual" },
  { value: "yearly", label: "Yearly" },
]

export function SubscriptionCard({
  id, merchantName, nickname, amount, frequency, status, isWanted, nextChargeDate,
  category, logoUrl, detectionMethod, averageAmount, accountName, accountMask,
  accountType, institutionName, recentTransactions, linkedTransaction, cancelReminderDate,
  onUpdateStatus, onToggleWanted, onRequestCancel, onUpdateNickname,
  onUpdateFrequency, onUpdateCategory, onSetReminder, onDismiss,
}: SubscriptionCardProps) {
  const [isEditingNickname, setIsEditingNickname] = useState(false)
  const [nicknameValue, setNicknameValue] = useState(nickname ?? "")
  const [showFreqPicker, setShowFreqPicker] = useState(false)
  const nicknameInputRef = useRef<HTMLInputElement>(null)
  const freqPickerRef = useRef<HTMLDivElement>(null)
  const isCancellingNicknameRef = useRef(false)

  useEffect(() => {
    if (!isEditingNickname) setNicknameValue(nickname ?? "")
  }, [nickname, isEditingNickname])

  useEffect(() => {
    if (isEditingNickname && nicknameInputRef.current) {
      nicknameInputRef.current.focus()
      nicknameInputRef.current.select()
    }
  }, [isEditingNickname])

  useEffect(() => {
    if (!showFreqPicker) return
    function handleClickOutside(e: MouseEvent) {
      if (freqPickerRef.current && !freqPickerRef.current.contains(e.target as Node)) {
        setShowFreqPicker(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showFreqPicker])

  const displayName = nickname || merchantName
  const paymentLabel = accountName ?? (
    institutionName && accountMask
      ? `${institutionName} ····${accountMask}`
      : accountMask
        ? `${accountType ?? "Account"} ····${accountMask}`
        : null
  )

  function handleNicknameSave() {
    if (isCancellingNicknameRef.current) {
      isCancellingNicknameRef.current = false
      return
    }
    const trimmed = nicknameValue.trim()
    const newNickname = trimmed === "" || trimmed === merchantName ? null : trimmed
    onUpdateNickname?.(id, newNickname)
    setIsEditingNickname(false)
  }

  function handleNicknameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleNicknameSave()
    if (e.key === "Escape") {
      isCancellingNicknameRef.current = true
      setNicknameValue(nickname ?? "")
      setIsEditingNickname(false)
    }
  }

  const txns = recentTransactions ?? []

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 space-y-3 hover:border-card-border-hover transition-colors duration-200">
      {/* Header: icon + name + amount */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <MerchantIcon logoUrl={logoUrl} category={category} />
          <div className="min-w-0 flex-1">
            {/* Nickname / Merchant name */}
            {isEditingNickname ? (
              <input
                ref={nicknameInputRef}
                value={nicknameValue}
                onChange={(e) => setNicknameValue(e.target.value)}
                onBlur={handleNicknameSave}
                onKeyDown={handleNicknameKeyDown}
                placeholder={merchantName}
                className="w-full text-sm font-semibold text-foreground bg-transparent border-b border-primary outline-none px-0 py-0"
              />
            ) : (
              <button
                onClick={() => {
                  setNicknameValue(nickname ?? merchantName)
                  setIsEditingNickname(true)
                }}
                className="text-left group/name flex items-center gap-1 max-w-full min-w-0"
                title="Click to rename"
              >
                <h4 className="text-sm font-semibold text-foreground group-hover/name:text-primary transition-colors truncate break-all">
                  {displayName}
                </h4>
                <span
                  className="material-symbols-rounded opacity-0 group-hover/name:opacity-50 transition-opacity flex-shrink-0"
                  style={{ fontSize: 12 }}
                >
                  edit
                </span>
              </button>
            )}

            {/* Merchant name subtitle (if nickname is set) */}
            {nickname && !isEditingNickname && (
              <p className="text-[10px] text-foreground-muted truncate">{merchantName}</p>
            )}

            {/* Frequency badge (clickable picker) + detection method */}
            <div className="flex items-center gap-1.5 mt-1 relative">
              <div ref={freqPickerRef} className="relative">
                <button
                  onClick={() => setShowFreqPicker(!showFreqPicker)}
                  className={cn(
                    "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer hover:ring-1 hover:ring-foreground-muted/20 transition-colors",
                    FREQUENCY_COLORS[frequency] ?? "bg-background-secondary text-foreground-muted"
                  )}
                  title="Click to change frequency"
                >
                  {FREQUENCY_LABELS[frequency] ?? frequency}
                  <span className="material-symbols-rounded" style={{ fontSize: 10 }}>
                    expand_more
                  </span>
                </button>
                {showFreqPicker && (
                  <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-card-border rounded-lg shadow-lg p-1.5 flex flex-wrap gap-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-150">
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          if (opt.value !== frequency) {
                            onUpdateFrequency?.(id, opt.value)
                          }
                          setShowFreqPicker(false)
                        }}
                        className={cn(
                          "px-2 py-1 rounded text-[10px] font-medium transition-colors",
                          opt.value === frequency
                            ? cn(FREQUENCY_COLORS[opt.value], "ring-1 ring-current/20")
                            : "bg-background-secondary/50 text-foreground-muted hover:bg-background-secondary"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {detectionMethod && DETECTION_LABELS[detectionMethod] && (
                <>
                  <span className="text-foreground-muted/50">·</span>
                  <span className={cn("text-[10px]", DETECTION_LABELS[detectionMethod].color)}>
                    {DETECTION_LABELS[detectionMethod].text}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Amount + next charge */}
        <div className="text-right flex-shrink-0 ml-3">
          <span className="font-data text-base font-semibold text-foreground tabular-nums">
            {formatCurrency(amount)}
          </span>
          {averageAmount != null && Math.abs(averageAmount - amount) > 0.01 && (
            <p className="text-[10px] text-foreground-muted tabular-nums">
              avg {formatCurrency(averageAmount)}
            </p>
          )}
          {nextChargeDate && (() => {
            const urgency = getBillingUrgency(nextChargeDate)
            return (
              <div className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium mt-1",
                urgency.colorClass
              )}>
                <span className="material-symbols-rounded" style={{ fontSize: 13 }}>
                  {urgency.daysUntil <= 3 ? "priority_high" : "event"}
                </span>
                {urgency.label}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Payment method */}
      {paymentLabel && (
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-rounded text-foreground-muted/60" style={{ fontSize: 14 }}>credit_card</span>
          <span className="text-[10px] text-foreground-muted truncate">{paymentLabel}</span>
        </div>
      )}

      {/* Status + actions */}
      <SubscriptionCardActions
        id={id}
        merchantName={merchantName}
        status={status}
        amount={amount}
        frequency={frequency}
        cancelReminderDate={cancelReminderDate}
        onUpdateStatus={onUpdateStatus}
        onRequestCancel={onRequestCancel}
        onSetReminder={onSetReminder}
        onDismiss={onDismiss}
      />

      {/* Linked transaction proof — the exact charge that proves this was paid */}
      {linkedTransaction && (
        <SubscriptionLinkedProof transaction={linkedTransaction} />
      )}

      {/* Expandable transaction history */}
      <SubscriptionCardTransactions transactions={txns} />
    </div>
  )
}
