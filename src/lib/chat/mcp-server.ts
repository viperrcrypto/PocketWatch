/**
 * MCP server core for PocketWatch — raw JSON-RPC 2.0 over HTTP.
 *
 * READ-ONLY: exposes only the tools in READ_ONLY_TOOL_NAMES (non-mutating,
 * non-expensive queries) via the Model Context Protocol. Write tools and live
 * searches are filtered out of tools/list AND rejected at tools/call, so a
 * crafted request can never reach a write executor. No SDK is used; the
 * protocol is implemented directly. Auth is fail-closed (Bearer token) and
 * enforced by the route before any method here runs. The vault is
 * single-user, so the owner's userId is resolved server-side and passed to
 * the executors.
 */

import { timingSafeEqual } from "crypto"
import { db } from "@/lib/db"
import { READ_ONLY_TOOL_NAMES, TOOL_DEFINITIONS } from "./tool-definitions"
import { executeTool } from "./tools"

export const MCP_PROTOCOL_VERSION = "2024-11-05"

const SERVER_INFO = { name: "pocketwatch-finance", version: "1.0.0" } as const

type RpcId = string | number | null

export interface JsonRpcRequest {
  jsonrpc?: string
  id?: RpcId
  method?: string
  params?: Record<string, unknown>
}

interface JsonRpcError {
  code: number
  message: string
}

interface JsonRpcSuccess {
  jsonrpc: "2.0"
  id: RpcId
  result: unknown
}

interface JsonRpcFailure {
  jsonrpc: "2.0"
  id: RpcId
  error: JsonRpcError
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure

export const JSONRPC_ERRORS = {
  PARSE: { code: -32700, message: "Parse error" },
  INVALID_REQUEST: { code: -32600, message: "Invalid Request" },
  METHOD_NOT_FOUND: { code: -32601, message: "Method not found" },
  INVALID_PARAMS: { code: -32602, message: "Invalid params" },
  INTERNAL: { code: -32603, message: "Internal error" },
} as const

// Only read-only tools are exposed over MCP — advertised AND dispatchable.
const MCP_TOOL_DEFINITIONS = TOOL_DEFINITIONS.filter((t) => READ_ONLY_TOOL_NAMES.has(t.name))
const MCP_TOOL_NAMES = new Set(MCP_TOOL_DEFINITIONS.map((t) => t.name))

/**
 * Fail-closed Bearer-token auth. Returns true only when the env token is set
 * AND the header carries an exactly-matching token. Uses a timing-safe compare
 * over equal-length buffers; differing lengths short-circuit to false.
 */
export function isAuthorized(authHeader: string | null): boolean {
  const token = process.env.POCKETWATCH_MCP_TOKEN
  // Refuse weak tokens: this is the entire perimeter for an internet-exposed
  // (Cloudflare tunnel) endpoint serving full financial data. Generate with
  // `openssl rand -hex 32`.
  if (!token || token.length < 32) return false
  if (!authHeader?.startsWith("Bearer ")) return false

  const provided = Buffer.from(authHeader.slice(7))
  const expected = Buffer.from(token)
  if (provided.length !== expected.length) return false
  return timingSafeEqual(provided, expected)
}

/** Map the read-only Claude-style tool schemas to MCP's inputSchema shape. */
function toMcpTools() {
  return MCP_TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.input_schema,
  }))
}

/** Resolve the single vault owner. MCP has no session, so we look it up. */
async function resolveOwnerId(): Promise<string | null> {
  const owner = await db.user.findFirst({ select: { id: true } })
  return owner?.id ?? null
}

function ok(id: RpcId | undefined, result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id: id ?? null, result }
}

function fail(id: RpcId | undefined, error: JsonRpcError): JsonRpcFailure {
  return { jsonrpc: "2.0", id: id ?? null, error }
}

async function handleToolsCall(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  const params = req.params ?? {}
  const name = params.name
  // Reject anything outside the read-only allowlist — including real write
  // tools a crafted client could name — before touching executeTool.
  if (typeof name !== "string" || !MCP_TOOL_NAMES.has(name)) {
    return fail(req.id, {
      ...JSONRPC_ERRORS.METHOD_NOT_FOUND,
      message: `Unknown or unavailable tool: ${String(name)}`,
    })
  }

  const rawArgs = params.arguments
  const args =
    rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {}

  const ownerId = await resolveOwnerId()
  if (!ownerId) {
    return fail(req.id, { ...JSONRPC_ERRORS.INTERNAL, message: "Vault not initialized" })
  }

  const text = await executeTool(name, args, ownerId)
  return ok(req.id, { content: [{ type: "text", text }] })
}

/**
 * Dispatch a single JSON-RPC request to the right MCP method. Returns the
 * response object, or null for notifications (which must yield an empty 202).
 * Never throws: unknown methods become method-not-found errors; the route
 * still wraps the call in try/catch as a backstop.
 */
export async function handleRpc(
  req: JsonRpcRequest
): Promise<JsonRpcResponse | null> {
  switch (req.method) {
    case "initialize":
      return ok(req.id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: SERVER_INFO,
        capabilities: { tools: {} },
      })
    case "notifications/initialized":
      return null
    case "tools/list":
      return ok(req.id, { tools: toMcpTools() })
    case "tools/call":
      return handleToolsCall(req)
    default:
      return fail(req.id, {
        ...JSONRPC_ERRORS.METHOD_NOT_FOUND,
        message: `Method not found: ${String(req.method)}`,
      })
  }
}
