/**
 * Finance MCP endpoint — raw JSON-RPC 2.0 over HTTP.
 *
 * SECURITY: read-only. Exposes the 12 PocketLLM financial query tools to
 * Claude Desktop/Code over the Cloudflare tunnel. Every request is gated,
 * fail-closed, on the POCKETWATCH_MCP_TOKEN env via a Bearer header with a
 * timing-safe compare. There is no session here, so the single vault owner's
 * userId is resolved server-side and passed to the executors. No tool writes.
 */

import { NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import {
  isAuthorized,
  handleRpc,
  JSONRPC_ERRORS,
  type JsonRpcRequest,
} from "@/lib/chat/mcp-server"
import { checkAuthFailureLimit } from "@/lib/internal-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function rpcErrorResponse(
  id: JsonRpcRequest["id"],
  error: { code: number; message: string },
  status: number
): NextResponse {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, error },
    { status }
  )
}

export async function POST(req: Request): Promise<NextResponse> {
  // Fail-closed auth gate: do NO work unless the Bearer token matches.
  if (!isAuthorized(req.headers.get("authorization"))) {
    // Failure-only throttle: successful auth never touches the limiter.
    const rl = checkAuthFailureLimit(req)
    if (!rl.ok) {
      return apiError("M1003", rl.response.error, 429, undefined, rl.headers)
    }
    return apiError("M1001", "Unauthorized", 401, undefined, {
      "WWW-Authenticate": "Bearer",
    })
  }

  let body: JsonRpcRequest
  try {
    body = (await req.json()) as JsonRpcRequest
  } catch {
    return rpcErrorResponse(null, JSONRPC_ERRORS.PARSE, 400)
  }

  if (!body || typeof body !== "object" || typeof body.method !== "string") {
    return rpcErrorResponse(body?.id ?? null, JSONRPC_ERRORS.INVALID_REQUEST, 400)
  }

  try {
    const result = await handleRpc(body)
    // Notifications (e.g. notifications/initialized) return no body.
    if (result === null) return new NextResponse(null, { status: 202 })
    return NextResponse.json(result)
  } catch (err) {
    // Never leak stack traces — return a JSON-RPC internal error.
    apiError("M1002", "MCP request failed", 500, err)
    return rpcErrorResponse(body.id ?? null, JSONRPC_ERRORS.INTERNAL, 500)
  }
}
