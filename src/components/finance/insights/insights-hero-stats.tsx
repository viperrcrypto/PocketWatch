"use client"

import { formatCurrency, cn } from "@/lib/utils"
import { FinanceStatCard } from "@/components/finance/stat-card"
import { FinanceCardSkeleton } from "@/components/finance/finance-loading"

interface InsightsHeroStatsProps {
  isLoading: boolean
  health: any
  spending: number
  income: number
  savingsRate: number
  velocity: any
  prevSpending: number
  spendingChange: number
}

export function InsightsHeroStats({
  isLoading,
  health,
  spending,
  income,
  savingsRate,
  velocity,
  prevSpending,
  spendingChange,
}: InsightsHeroStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => <FinanceCardSkeleton key={i} />)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {health && <HealthScoreGauge score={health.score} grade={health.grade} />}
      <FinanceStatCard
        label="Spending"
        value={formatCurrency(spending)}
        icon="shopping_cart"
        change={spendingChange !== 0 ? {
          value: `${Math.abs(spendingChange).toFixed(1)}% MoM`,
          positive: spendingChange < 0,
        } : undefined}
      />
      <FinanceStatCard
        label="Income"
        value={formatCurrency(income)}
        icon="payments"
        accentColor="var(--success)"
      />
      <FinanceStatCard
        label="Savings Rate"
        value={`${savingsRate.toFixed(1)}%`}
        icon="savings"
        accentColor={savingsRate >= 20 ? "var(--success)" : "var(--warning)"}
      />
      <FinanceStatCard
        label="Spending Velocity"
        value={`${formatCurrency(velocity?.dailyAvg ?? 0)}/day`}
        icon="speed"
        change={velocity ? {
          value: `${formatCurrency(velocity.projectedTotal)} projected`,
          positive: velocity.projectedTotal < prevSpending,
        } : undefined}
      />
    </div>
  )
}

function HealthScoreGauge({ score, grade }: { score: number; grade: string }) {
  const SIZE = 120
  const STROKE = 10
  const RADIUS = (SIZE - STROKE) / 2
  const CENTER = SIZE / 2
  // Arc spans 240 degrees (from 150° to 390° / -210° to 30°)
  const ARC_DEGREES = 240
  const START_ANGLE = 150
  const circumference = 2 * Math.PI * RADIUS
  const arcLength = (ARC_DEGREES / 360) * circumference
  const filledLength = (score / 100) * arcLength
  const dashOffset = arcLength - filledLength

  // Color based on score
  const color = score >= 80 ? "var(--success)" : score >= 60 ? "var(--warning)" : "var(--error)"
  const bgGlow = score >= 80 ? "var(--success)" : score >= 60 ? "var(--warning)" : "var(--error)"

  // Convert angle to radians for start point
  const startRad = (START_ANGLE * Math.PI) / 180
  const startX = CENTER + RADIUS * Math.cos(startRad)
  const startY = CENTER + RADIUS * Math.sin(startRad)

  // Arc end angle
  const endAngle = START_ANGLE + ARC_DEGREES
  const endRad = (endAngle * Math.PI) / 180
  const endX = CENTER + RADIUS * Math.cos(endRad)
  const endY = CENTER + RADIUS * Math.sin(endRad)

  // Create arc path for background track
  const largeArc = ARC_DEGREES > 180 ? 1 : 0
  const trackPath = `M ${startX} ${startY} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${endX} ${endY}`

  return (
    <div
      className="bg-card border border-card-border rounded-xl p-5 flex flex-col items-center justify-center col-span-2 lg:col-span-1 relative overflow-hidden"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      {/* Subtle glow behind gauge */}
      <div
        className="absolute inset-0 opacity-[0.04] blur-3xl"
        style={{ background: `radial-gradient(circle at 50% 40%, ${bgGlow}, transparent 70%)` }}
      />

      <div className="relative" style={{ width: SIZE, height: SIZE - 16 }}>
        <svg
          width={SIZE}
          height={SIZE - 16}
          viewBox={`0 0 ${SIZE} ${SIZE - 8}`}
          className="overflow-visible"
        >
          {/* Background track */}
          <path
            d={trackPath}
            fill="none"
            stroke="var(--card-border)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d={trackPath}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${arcLength}`}
            strokeDashoffset={dashOffset}
            className="transition-colors duration-1000 ease-out"
            style={{
              filter: `drop-shadow(0 0 6px color-mix(in srgb, ${color} 40%, transparent))`,
            }}
          />
          {/* Tick marks at 0, 25, 50, 75, 100 */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = START_ANGLE + (tick / 100) * ARC_DEGREES
            const rad = (angle * Math.PI) / 180
            const innerR = RADIUS - STROKE / 2 - 3
            const outerR = RADIUS - STROKE / 2 - 8
            return (
              <line
                key={tick}
                x1={CENTER + innerR * Math.cos(rad)}
                y1={CENTER + innerR * Math.sin(rad)}
                x2={CENTER + outerR * Math.cos(rad)}
                y2={CENTER + outerR * Math.sin(rad)}
                stroke="var(--foreground-muted)"
                strokeWidth={1}
                opacity={0.3}
              />
            )
          })}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: 8 }}>
          <span
            className="font-data text-3xl font-black tabular-nums leading-none"
            style={{ color }}
          >
            {grade}
          </span>
          <span
            className="font-data text-sm font-bold tabular-nums mt-0.5"
            style={{ color }}
          >
            {score}
          </span>
        </div>
      </div>

      <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mt-1">
        Health Score
      </span>
    </div>
  )
}
