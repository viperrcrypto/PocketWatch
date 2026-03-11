import { NextRequest, NextResponse } from "next/server"

// Redirects to the new lock endpoint for backwards compatibility
export async function POST(request: NextRequest) {
  const url = new URL("/api/auth/lock", request.url)
  return NextResponse.rewrite(url)
}
