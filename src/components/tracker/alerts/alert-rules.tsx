"use client"

import { useState, useCallback } from "react"
import { useUpdateTelegramSettings, useTelegramLink } from "@/hooks/use-tracker"
import type { AlertRule, AlertPriority } from "@/lib/tracker/types"

// Font constants removed — use Tailwind classes instead

interface AlertRuleConfig {
  id: string
  label: string
  description: string
  alertType: string
  icon: string
  hasThreshold: boolean
  defaultEnabled: boolean
}

const ALERT_RULE_CONFIGS: AlertRuleConfig[] = [
  {
    id: "all_transactions",
    label: "All Transactions",
    description: "Get notified for every transaction from tracked wallets",
    alertType: "ALL",
    icon: "notifications_active",
    hasThreshold: false,
    defaultEnabled: true,
  },
  {
    id: "buys_over_threshold",
    label: "Buys Over Threshold",
    description: "Only alert for buy transactions exceeding a USD value",
    alertType: "BUY_OVER",
    icon: "shopping_cart",
    hasThreshold: true,
    defaultEnabled: false,
  },
  {
    id: "sells_only",
    label: "Sells Only",
    description: "Only receive alerts when tracked wallets sell tokens",
    alertType: "SELL",
    icon: "sell",
    hasThreshold: false,
    defaultEnabled: false,
  },
  {
    id: "new_token_purchases",
    label: "New Token Purchases",
    description: "Alert when a wallet buys a token for the first time",
    alertType: "NEW_TOKEN",
    icon: "new_releases",
    hasThreshold: false,
    defaultEnabled: false,
  },
  {
    id: "large_transfers",
    label: "Large Transfers",
    description: "Alert on transfers above a USD threshold",
    alertType: "LARGE_TRANSFER",
    icon: "swap_horiz",
    hasThreshold: true,
    defaultEnabled: false,
  },
  {
    id: "confluence",
    label: "Confluence Alerts",
    description: "Multiple tracked wallets buying the same token",
    alertType: "CONFLUENCE",
    icon: "join_inner",
    hasThreshold: false,
    defaultEnabled: false,
  },
]

const PRIORITY_OPTIONS: { value: AlertPriority; label: string; color: string; icon: string }[] = [
  { value: "normal", label: "Normal", color: "var(--foreground-muted)", icon: "notifications" },
  { value: "high", label: "High", color: "var(--warning)", icon: "priority_high" },
  { value: "urgent", label: "Urgent", color: "var(--error)", icon: "crisis_alert" },
]

interface RuleState {
  enabled: boolean
  minValueUsd?: number
  priority: AlertPriority
}

export default function AlertRules() {
  const { data: linkStatus } = useTelegramLink()
  const updateSettings = useUpdateTelegramSettings()
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const [rules, setRules] = useState<Record<string, RuleState>>(() => {
    const initial: Record<string, RuleState> = {}
    for (const config of ALERT_RULE_CONFIGS) {
      initial[config.id] = {
        enabled: config.defaultEnabled,
        minValueUsd: config.hasThreshold ? 100 : undefined,
        priority: "normal",
      }
    }
    return initial
  })

  const isLinked = linkStatus?.isLinked ?? false

  const handleToggle = useCallback((ruleId: string) => {
    setRules((prev) => ({
      ...prev,
      [ruleId]: { ...prev[ruleId], enabled: !prev[ruleId].enabled },
    }))
  }, [])

  const handleThresholdChange = useCallback((ruleId: string, value: string) => {
    const num = parseFloat(value)
    setRules((prev) => ({
      ...prev,
      [ruleId]: { ...prev[ruleId], minValueUsd: isNaN(num) ? undefined : num },
    }))
  }, [])

  const handlePriorityChange = useCallback((ruleId: string, priority: AlertPriority) => {
    setRules((prev) => ({
      ...prev,
      [ruleId]: { ...prev[ruleId], priority },
    }))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const alertRules: AlertRule[] = ALERT_RULE_CONFIGS.map((config) => {
        const state = rules[config.id]
        return {
          id: config.id,
          label: config.label,
          alertType: config.alertType,
          enabled: state?.enabled ?? config.defaultEnabled,
          minValueUsd: state?.minValueUsd,
          priority: state?.priority ?? "normal",
        }
      })

      await updateSettings.mutateAsync({
        alertRules,
        isActive: true,
      })
      setLastSaved(new Date())
    } catch {
      // Error handled by mutation
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Alert Rules
          </h3>
          <p className="text-[11px] text-foreground-muted mt-1">
            Configure which transactions trigger notifications
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-[10px] text-success">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={saving || !isLinked}
            style={{ opacity: saving || !isLinked ? 0.4 : 1 }}
          >
            {saving ? (
              <>
                <span className="loading-spinner mr-2" />
                Saving...
              </>
            ) : (
              <>
                <span className="material-symbols-rounded mr-2" style={{ fontSize: 16 }}>
                  save
                </span>
                Save Rules
              </>
            )}
          </button>
        </div>
      </div>

      {/* Not linked warning */}
      {!isLinked && (
        <div className="flex items-center gap-2 p-3 border border-warning bg-warning-muted rounded-lg">
          <span className="material-symbols-rounded text-warning" style={{ fontSize: 16 }}>
            warning
          </span>
          <span className="text-[11px] text-warning">
            Connect your Telegram account above to enable alert rules.
          </span>
        </div>
      )}

      {/* Rule cards */}
      <div className="space-y-2">
        {ALERT_RULE_CONFIGS.map((config) => {
          const state = rules[config.id]
          const isEnabled = state?.enabled ?? false
          const priority = state?.priority ?? "normal"
          const priorityConfig = PRIORITY_OPTIONS.find((p) => p.value === priority)!
          const isHighPriority = priority !== "normal"

          // Border color reflects priority when enabled
          const accentColor = !isEnabled
            ? "var(--card-border)"
            : isHighPriority
              ? priorityConfig.color
              : "var(--success)"

          return (
            <div
              key={config.id}
              className="bg-card border border-card-border rounded-lg p-4 transition-all duration-200"
              style={{
                opacity: isLinked ? 1 : 0.5,
                borderLeft: `3px solid ${accentColor}`,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-9 w-9 flex items-center justify-center shrink-0 border"
                    style={{
                      borderColor: accentColor,
                      backgroundColor: isEnabled ? `color-mix(in srgb, ${accentColor} 8%, transparent)` : "var(--background-secondary)",
                    }}
                  >
                    <span
                      className="material-symbols-rounded"
                      style={{
                        fontSize: 18,
                        color: isEnabled ? accentColor : "var(--foreground-muted)",
                      }}
                    >
                      {config.icon}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{config.label}</p>
                    <p className="text-[10px] text-foreground-muted truncate">{config.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Toggle */}
                  <button
                    onClick={() => isLinked && handleToggle(config.id)}
                    className="admin-toggle"
                    data-state={isEnabled ? "on" : "off"}
                    disabled={!isLinked}
                    style={{ cursor: isLinked ? "pointer" : "not-allowed" }}
                  >
                    <span className="admin-toggle-thumb" />
                  </button>
                </div>
              </div>

              {/* Expanded controls when enabled */}
              {isEnabled && (
                <div className="mt-3 pt-3 flex flex-wrap items-center gap-4 border-t border-card-border">
                  {/* Threshold input */}
                  {config.hasThreshold && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-foreground-muted uppercase tracking-wider">
                        Min $
                      </span>
                      <input
                        type="number"
                        value={state?.minValueUsd ?? ""}
                        onChange={(e) => handleThresholdChange(config.id, e.target.value)}
                        className="w-20 h-7 px-2 bg-background border border-card-border text-foreground focus:border-foreground transition-colors text-[11px] font-data"
                        placeholder="100"
                        min={0}
                        step={10}
                        disabled={!isLinked}
                      />
                    </div>
                  )}

                  {/* Priority selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-foreground-muted uppercase tracking-wider mr-1">
                      Priority
                    </span>
                    {PRIORITY_OPTIONS.map((opt) => {
                      const isActive = priority === opt.value
                      return (
                        <button
                          key={opt.value}
                          onClick={() => isLinked && handlePriorityChange(config.id, opt.value)}
                          className="flex items-center gap-1 transition-all duration-150 text-[10px] uppercase px-2 py-0.5 border rounded"
                          style={{
                            fontWeight: isActive ? 700 : 500,
                            background: isActive ? `${opt.color}15` : "transparent",
                            borderColor: isActive ? opt.color : "var(--card-border)",
                            color: isActive ? opt.color : "var(--foreground-muted)",
                            cursor: isLinked ? "pointer" : "not-allowed",
                          }}
                          disabled={!isLinked}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: 12 }}>
                            {opt.icon}
                          </span>
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Priority legend */}
      <div className="flex items-center gap-4 pt-2 text-[10px] text-foreground-muted">
        <span className="uppercase tracking-wider">Priority levels:</span>
        {PRIORITY_OPTIONS.map((opt) => (
          <span key={opt.value} className="flex items-center gap-1">
            <span className="material-symbols-rounded" style={{ fontSize: 11, color: opt.color }}>{opt.icon}</span>
            <span style={{ color: opt.color }}>{opt.label}</span>
            {opt.value === "normal" && " — standard feed"}
            {opt.value === "high" && " — highlighted in feed + TG"}
            {opt.value === "urgent" && " — siren alerts everywhere"}
          </span>
        ))}
      </div>

      {/* Save error */}
      {updateSettings.isError && (
        <div className="flex items-center gap-2 p-3 border border-error bg-error-muted rounded-lg">
          <span className="material-symbols-rounded text-error" style={{ fontSize: 16 }}>
            error
          </span>
          <span className="text-[11px] text-error">
            {updateSettings.error?.message || "Failed to save alert rules"}
          </span>
        </div>
      )}
    </div>
  )
}
