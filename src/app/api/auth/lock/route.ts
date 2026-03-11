import { NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import { deleteSession } from "@/lib/auth"

export async function POST() {
  try {
    await deleteSession()
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("E1080", "Lock failed", 500, error)
  }
}
