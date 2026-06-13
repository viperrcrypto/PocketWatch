/**
 * Trip expense auto-tagging API.
 *
 * POST   = tag every untagged transaction inside the trip window to this trip.
 * GET    = spend summary (count, total, byCategory) for this trip.
 * DELETE = untag all transactions from this trip.
 *
 * Every operation is scoped to the authenticated user; the lib layer re-checks
 * Trip.userId so a forged tripId can never touch another vault's data.
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import {
  tagTripExpenses,
  untagTrip,
  tripSpendSummary,
} from "@/lib/finance/trip-expenses"
import { NextResponse } from "next/server"

type RouteContext = { params: Promise<{ id: string }> }

const NOT_FOUND = "Trip not found"

export async function POST(_req: Request, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return apiError("T5001", "Authentication required", 401)

  const { id } = await params
  if (!id) return apiError("T5002", "Trip id is required", 400)

  try {
    const result = await tagTripExpenses(user.id, id)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Error && err.message === NOT_FOUND) {
      return apiError("T5003", NOT_FOUND, 404)
    }
    return apiError("T5004", "Failed to tag trip expenses", 500, err)
  }
}

export async function GET(_req: Request, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return apiError("T5010", "Authentication required", 401)

  const { id } = await params
  if (!id) return apiError("T5011", "Trip id is required", 400)

  try {
    const summary = await tripSpendSummary(user.id, id)
    return NextResponse.json(summary)
  } catch (err) {
    if (err instanceof Error && err.message === NOT_FOUND) {
      return apiError("T5012", NOT_FOUND, 404)
    }
    return apiError("T5013", "Failed to load trip spend summary", 500, err)
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const user = await getCurrentUser()
  if (!user) return apiError("T5020", "Authentication required", 401)

  const { id } = await params
  if (!id) return apiError("T5021", "Trip id is required", 400)

  try {
    const result = await untagTrip(user.id, id)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Error && err.message === NOT_FOUND) {
      return apiError("T5022", NOT_FOUND, 404)
    }
    return apiError("T5023", "Failed to untag trip", 500, err)
  }
}
