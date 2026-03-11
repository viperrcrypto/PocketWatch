import { NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import { isVaultInitialized } from "@/lib/auth"

export async function GET() {
  try {
    const initialized = await isVaultInitialized()
    return NextResponse.json({ initialized })
  } catch (error) {
    return apiError("E1050", "Failed to check vault status", 500, error)
  }
}
