/**
 * PocketLLM finance ACTION (write) tool executors.
 *
 * Mirrors the validation + userId-scoping of the matching routes under
 * src/app/api/finance/ (budgets, transactions, subscriptions, bills/cards).
 * Every write resolves userId from the dispatcher's server session — never from
 * tool args — and verifies ownership via updateMany/deleteMany {id, userId} or a
 * findFirst ownership check before mutating. Inputs are validated with zod.
 * External free-text (category/subcategory) is run through the sanitizer.
 */

import { db } from "@/lib/db"
import { projectNextDate } from "@/lib/finance/bill-helpers"
import { cleanText } from "./sanitize"
import { z } from "zod/v4"

type ToolInput = Record<string, unknown>

function fail(message: string): string {
  return JSON.stringify({ error: message })
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input"
}

// ─── Budgets (mirrors /api/finance/budgets) ──────────────────────

const BUDGET_SELECT = {
  id: true, category: true, monthlyLimit: true, rollover: true, isActive: true,
} as const

const createBudgetSchema = z.object({
  category: z.string().trim().min(1, "Category is required").max(100),
  monthlyLimit: z.number().positive("Monthly limit must be positive"),
  rollover: z.boolean().optional(),
})

export async function createBudget(userId: string, input: ToolInput): Promise<string> {
  const parsed = createBudgetSchema.safeParse(input)
  if (!parsed.success) return fail(firstIssue(parsed.error))
  const category = cleanText(parsed.data.category)
  const { monthlyLimit, rollover } = parsed.data

  const budget = await db.financeBudget.upsert({
    where: { userId_category: { userId, category } },
    create: { userId, category, monthlyLimit, rollover: rollover ?? false },
    // Re-creating an existing category reactivates it + sets the limit, but only
    // touches rollover when explicitly provided (don't silently reset the flag).
    update: { monthlyLimit, ...(rollover !== undefined && { rollover }), isActive: true },
    select: BUDGET_SELECT,
  })
  return JSON.stringify({ type: "budgets", created: true, budgets: [budget] })
}

// Note: isActive is intentionally NOT exposed here — deactivating a budget hides
// it from every surface (a soft-delete), so it stays a UI-only action like delete.
const updateBudgetSchema = z
  .object({
    budgetId: z.string().min(1, "budgetId is required"),
    monthlyLimit: z.number().positive().optional(),
    rollover: z.boolean().optional(),
  })
  .refine((d) => d.monthlyLimit !== undefined || d.rollover !== undefined, {
    message: "No fields to update",
  })

export async function updateBudget(userId: string, input: ToolInput): Promise<string> {
  const parsed = updateBudgetSchema.safeParse(input)
  if (!parsed.success) return fail(firstIssue(parsed.error))
  const { budgetId, monthlyLimit, rollover } = parsed.data

  const { count } = await db.financeBudget.updateMany({
    where: { id: budgetId, userId },
    data: {
      ...(monthlyLimit !== undefined && { monthlyLimit }),
      ...(rollover !== undefined && { rollover }),
    },
  })
  if (count === 0) return fail("Budget not found")
  const budget = await db.financeBudget.findFirst({ where: { id: budgetId, userId }, select: BUDGET_SELECT })
  return JSON.stringify({ type: "budgets", updated: true, budgets: budget ? [budget] : [] })
}

// (No deleteBudget tool — hard delete is a confirm-gated UI action only.)

// ─── Transactions (mirrors /api/finance/transactions PATCH) ───────

const recategorizeSchema = z.object({
  transactionId: z.string().min(1, "transactionId is required"),
  category: z.string().trim().min(1, "Category is required").max(100),
  subcategory: z.string().trim().max(100).optional(),
})

export async function setTransactionCategory(userId: string, input: ToolInput): Promise<string> {
  const parsed = recategorizeSchema.safeParse(input)
  if (!parsed.success) return fail(firstIssue(parsed.error))
  const { transactionId } = parsed.data
  const category = cleanText(parsed.data.category)
  const subcategory = parsed.data.subcategory !== undefined ? cleanText(parsed.data.subcategory) : undefined

  const { count } = await db.financeTransaction.updateMany({
    where: { id: transactionId, userId },
    data: { category, ...(subcategory !== undefined && { subcategory }) },
  })
  if (count === 0) return fail("Transaction not found")
  return JSON.stringify({ updated: true, transactionId, category, subcategory: subcategory ?? null })
}

const excludeSchema = z.object({
  transactionId: z.string().min(1, "transactionId is required"),
  excluded: z.boolean(),
})

export async function excludeTransaction(userId: string, input: ToolInput): Promise<string> {
  const parsed = excludeSchema.safeParse(input)
  if (!parsed.success) return fail(firstIssue(parsed.error))
  const { transactionId, excluded } = parsed.data

  const { count } = await db.financeTransaction.updateMany({
    where: { id: transactionId, userId },
    data: { isExcluded: excluded },
  })
  if (count === 0) return fail("Transaction not found")
  return JSON.stringify({ updated: true, transactionId, excluded })
}

// ─── Bills (subscription rollover / credit-card payment marker) ───

const markBillPaidSchema = z
  .object({
    billId: z.string().min(1).optional(),
    creditCardId: z.string().min(1).optional(),
    paid: z.boolean(),
  })
  .refine((d) => !!d.billId !== !!d.creditCardId, {
    message: "Provide exactly one of billId or creditCardId",
  })

export async function markBillPaid(userId: string, input: ToolInput): Promise<string> {
  const parsed = markBillPaidSchema.safeParse(input)
  if (!parsed.success) return fail(firstIssue(parsed.error))
  const { billId, creditCardId, paid } = parsed.data

  if (creditCardId) return markCreditCardBillPaid(userId, creditCardId, paid)
  return markSubscriptionBillPaid(userId, billId as string, paid)
}

async function markSubscriptionBillPaid(userId: string, billId: string, paid: boolean): Promise<string> {
  const sub = await db.financeSubscription.findFirst({
    where: { id: billId, userId },
    select: { id: true, frequency: true, nextChargeDate: true },
  })
  if (!sub) return fail("Bill not found")

  const now = new Date()
  if (paid) {
    // Project from the scheduled due date (not "now") to avoid schedule drift.
    const next = projectNextDate(sub.nextChargeDate ?? now, sub.frequency) ?? now
    await db.financeSubscription.updateMany({
      where: { id: billId, userId },
      data: { lastChargeDate: now, nextChargeDate: next },
    })
    return JSON.stringify({ updated: true, billId, paid: true, nextChargeDate: next.toISOString() })
  }

  // Un-mark: pull the next charge date to today so the bill reads as due again.
  await db.financeSubscription.updateMany({
    where: { id: billId, userId },
    data: { nextChargeDate: now, lastTransactionId: null },
  })
  return JSON.stringify({ updated: true, billId, paid: false })
}

async function markCreditCardBillPaid(userId: string, creditCardId: string, paid: boolean): Promise<string> {
  const card = await db.financeLiabilityCreditCard.findFirst({
    where: { id: creditCardId, userId },
    select: { id: true, lastStatementBalance: true },
  })
  if (!card) return fail("Credit card not found")

  const { count } = await db.financeLiabilityCreditCard.updateMany({
    where: { id: creditCardId, userId },
    data: paid
      ? { lastPaymentDate: new Date(), lastPaymentAmount: card.lastStatementBalance ?? undefined, isOverdue: false }
      : { lastPaymentDate: null, lastPaymentAmount: null },
  })
  if (count === 0) return fail("Credit card not found")
  return JSON.stringify({ updated: true, creditCardId, paid })
}
