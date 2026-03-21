/**
 * PocketLLM agent loops — provider-specific streaming + tool execution.
 * Supports Claude API (native tool_use), Claude CLI (with --system-prompt),
 * and generic providers (prompt-based tools).
 */

import { spawn } from "child_process"
import { existsSync } from "fs"
import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { detectClaudeCLI, callAIProviderRaw, type AIProviderConfig, type AIProviderType } from "@/lib/finance/ai-providers"
import { SYSTEM_PROMPT } from "./system-prompt"
import { TOOL_DEFINITIONS } from "./tool-definitions"
import { executeTool } from "./tools"

const MAX_TOOL_ITERATIONS = 5
const AI_SERVICES = ["ai_claude_cli", "ai_claude_api", "ai_openai", "ai_gemini"]

export type SendFn = (event: string, data: unknown) => void

export interface ResolvedProvider {
  type: AIProviderType
  apiKey: string
  model?: string
}

// ─── Provider Resolution ────────────────────────────────────────

export async function resolveProvider(userId: string): Promise<ResolvedProvider> {
  const providerKey = await db.externalApiKey.findFirst({
    where: { userId, serviceName: { in: AI_SERVICES }, verified: true },
    orderBy: { updatedAt: "desc" },
  })

  if (providerKey) {
    const apiKey = providerKey.serviceName === "ai_claude_cli"
      ? "enabled"
      : await decryptCredential(providerKey.apiKeyEnc)
    return {
      type: providerKey.serviceName as AIProviderType,
      apiKey,
      model: providerKey.model ?? undefined,
    }
  }

  // Fallback: auto-detect Claude CLI
  const cliAvailable = await detectClaudeCLI()
  if (cliAvailable) {
    return { type: "ai_claude_cli", apiKey: "enabled" }
  }

  // Fallback: ANTHROPIC_API_KEY env var
  const envKey = process.env.ANTHROPIC_API_KEY
  if (envKey) {
    return { type: "ai_claude_api", apiKey: envKey }
  }

  throw new Error("No AI provider configured. Go to Finance Settings to set one up.")
}

// ─── Dispatch ───────────────────────────────────────────────────

export async function runAgentLoop(
  provider: ResolvedProvider,
  messages: { role: string; content: string }[],
  userId: string,
  send: SendFn
) {
  if (provider.type === "ai_claude_api") {
    return runClaudeAPILoop(provider.apiKey, provider.model, messages, userId, send)
  }
  if (provider.type === "ai_claude_cli") {
    return runCLILoop(provider.model, messages, userId, send)
  }
  return runGenericLoop(provider, messages, userId, send)
}

// ─── Claude API Loop (native tool_use) ──────────────────────────

interface ClaudeContentBlock {
  type: "text" | "tool_use" | "tool_result"
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
  _inputJson?: string // accumulates partial JSON during streaming
}

async function runClaudeAPILoop(
  apiKey: string,
  model: string | undefined,
  messages: { role: string; content: string }[],
  userId: string,
  send: SendFn
) {
  const claudeMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }))

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model ?? "claude-sonnet-4-20250514",
        max_tokens: 4096,
        stream: true,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages: claudeMessages,
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => "")
      throw new Error(`Claude API error ${res.status}: ${errBody.slice(0, 200)}`)
    }

    // Parse the streaming response
    const { contentBlocks, stopReason } = await consumeClaudeStream(res, send)

    if (stopReason !== "tool_use") return

    const toolUseBlocks = contentBlocks.filter((b) => b.type === "tool_use")
    if (toolUseBlocks.length === 0) return

    claudeMessages.push({ role: "assistant", content: contentBlocks as unknown as string })

    const toolResults: ClaudeContentBlock[] = []
    for (const toolBlock of toolUseBlocks) {
      const toolName = toolBlock.name!
      const toolInput = toolBlock.input ?? {}
      const toolUseId = toolBlock.id!

      send("tool_start", { name: toolName, input: toolInput })

      let result: string
      try {
        result = await executeTool(toolName, toolInput, userId)
      } catch (err) {
        result = JSON.stringify({ error: (err as Error).message })
      }

      const truncated = result.length > 8000 ? result.slice(0, 8000) + "\n...(truncated)" : result
      send("tool_result", { name: toolName, result: truncated })
      toolResults.push({ type: "tool_result", tool_use_id: toolUseId, content: truncated })
    }

    claudeMessages.push({ role: "user", content: toolResults as unknown as string })
  }

  send("text_delta", { content: "\n\n(Reached maximum tool iterations)" })
}

/** Consume Claude streaming SSE and emit text deltas in real-time */
async function consumeClaudeStream(
  res: Response,
  send: SendFn
): Promise<{ contentBlocks: ClaudeContentBlock[]; stopReason: string }> {
  const contentBlocks: ClaudeContentBlock[] = []
  let stopReason = "end_turn"

  const reader = res.body?.getReader()
  if (!reader) return { contentBlocks, stopReason }

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Process complete SSE events (separated by double newlines)
    while (true) {
      const eventEnd = buffer.indexOf("\n\n")
      if (eventEnd < 0) break

      const eventBlock = buffer.slice(0, eventEnd)
      buffer = buffer.slice(eventEnd + 2)

      let eventType = ""
      let eventData = ""
      for (const line of eventBlock.split("\n")) {
        if (line.startsWith("event: ")) eventType = line.slice(7)
        else if (line.startsWith("data: ")) eventData = line.slice(6)
      }

      if (!eventType || !eventData) continue

      try {
        const data = JSON.parse(eventData)
        switch (eventType) {
          case "content_block_start": {
            const block = data.content_block as ClaudeContentBlock
            contentBlocks.push({ ...block })
            break
          }
          case "content_block_delta": {
            const delta = data.delta
            const idx = data.index as number
            if (delta?.type === "text_delta" && delta.text) {
              send("text_delta", { content: delta.text })
              if (contentBlocks[idx]) {
                contentBlocks[idx].text = (contentBlocks[idx].text ?? "") + delta.text
              }
            } else if (delta?.type === "input_json_delta" && delta.partial_json) {
              if (contentBlocks[idx]) {
                contentBlocks[idx]._inputJson = (contentBlocks[idx]._inputJson ?? "") + delta.partial_json
              }
            }
            break
          }
          case "content_block_stop": {
            const idx = data.index as number
            const block = contentBlocks[idx]
            if (block?.type === "tool_use" && block._inputJson) {
              try { block.input = JSON.parse(block._inputJson) } catch { block.input = {} }
              delete block._inputJson
            }
            break
          }
          case "message_delta": {
            if (data.delta?.stop_reason) stopReason = data.delta.stop_reason
            break
          }
        }
      } catch { /* skip malformed events */ }
    }
  }

  return { contentBlocks, stopReason }
}

// ─── Claude CLI Loop (uses --system-prompt flag) ─────────────────

function resolveClaudeBin(): string {
  const home = process.env.HOME ?? ""
  const candidates = [
    `${home}/.local/bin/claude`,
    `${home}/.claude/bin/claude`,
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return "claude"
}

/** Streams CLI output, calling onChunk for each text chunk. Returns full output. */
function streamCLIWithSystemPrompt(
  systemPrompt: string,
  userMessage: string,
  onChunk: (text: string) => void,
  model?: string
): Promise<string> {
  const bin = resolveClaudeBin()
  return new Promise((resolve, reject) => {
    const { CLAUDECODE, CLAUDE_CODE, CLAUDE_CODE_ENTRYPOINT, ...cleanEnv } = process.env
    const args = ["-p", "--output-format", "text", "--system-prompt", systemPrompt, "--dangerously-skip-permissions"]
    if (model) args.push("--model", model)
    const child = spawn(bin, args, {
      env: { ...cleanEnv, TERM: "dumb" },
      stdio: ["pipe", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d: Buffer) => {
      const chunk = d.toString()
      stdout += chunk
      onChunk(chunk)
    })
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString() })

    const timer = setTimeout(() => {
      child.kill("SIGTERM")
      reject(new Error("Claude CLI timed out after 120s"))
    }, 120_000)

    child.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(`Claude CLI exited ${code}: ${(stderr || stdout).slice(0, 300)}`))
    })

    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      reject(new Error(`Claude CLI failed: ${err.message}`))
    })

    child.stdin.write(userMessage)
    child.stdin.end()
  })
}

async function runCLILoop(
  model: string | undefined,
  messages: { role: string; content: string }[],
  userId: string,
  send: SendFn
) {
  const systemPrompt = buildToolSystemPrompt()
  const toolContext: string[] = []

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const userMessage = buildUserMessage(messages, toolContext)

    // Stream text chunks in real-time to the client
    const streamed: string[] = []
    const response = await streamCLIWithSystemPrompt(
      systemPrompt,
      userMessage,
      (chunk) => {
        streamed.push(chunk)
        // Send chunk immediately — we'll clean up if it's a tool call
        send("text_delta", { content: chunk })
      },
      model
    )

    const toolCall = parseToolCall(response)
    if (!toolCall) {
      // Already streamed. If there was tool JSON mixed in, send a correction.
      const clean = stripToolJSON(response)
      if (clean !== response && clean) {
        // Re-send the cleaned version (clear + replace via a special event)
        send("text_replace", { content: clean })
      }
      return
    }

    // Tool call detected — replace streamed text with just the tool call UI
    send("text_replace", { content: stripToolJSON(response).trim() })
    send("tool_start", { name: toolCall.tool, input: toolCall.args })

    let result: string
    try {
      result = await executeTool(toolCall.tool, toolCall.args, userId)
    } catch (err) {
      result = JSON.stringify({ error: (err as Error).message })
    }

    const truncated = result.length > 8000 ? result.slice(0, 8000) + "\n...(truncated)" : result
    send("tool_result", { name: toolCall.tool, result: truncated })
    toolContext.push(`Tool "${toolCall.tool}" returned: ${truncated}`)
  }

  send("text_delta", { content: "\n\n(Reached maximum tool iterations)" })
}

// ─── Generic Loop (OpenAI / Gemini via prompt-based tools) ───────

async function runGenericLoop(
  provider: ResolvedProvider,
  messages: { role: string; content: string }[],
  userId: string,
  send: SendFn
) {
  const config: AIProviderConfig = {
    provider: provider.type,
    apiKey: provider.apiKey,
    model: provider.model,
  }

  const toolContext: string[] = []

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const prompt = buildToolSystemPrompt() + "\n\n" + buildUserMessage(messages, toolContext)
    const response = await callAIProviderRaw(config, prompt)

    const toolCall = parseToolCall(response)
    if (!toolCall) {
      const cleanResponse = stripToolJSON(response)
      send("text_delta", { content: cleanResponse || response })
      return
    }

    send("tool_start", { name: toolCall.tool, input: toolCall.args })

    let result: string
    try {
      result = await executeTool(toolCall.tool, toolCall.args, userId)
    } catch (err) {
      result = JSON.stringify({ error: (err as Error).message })
    }

    const truncated = result.length > 8000 ? result.slice(0, 8000) + "\n...(truncated)" : result
    send("tool_result", { name: toolCall.tool, result: truncated })
    toolContext.push(`Tool "${toolCall.tool}" returned: ${truncated}`)
  }

  send("text_delta", { content: "\n\n(Reached maximum tool iterations)" })
}

// ─── Shared Helpers ─────────────────────────────────────────────

function buildToolSystemPrompt(): string {
  const toolDescriptions = TOOL_DEFINITIONS.map((t) => {
    const params = Object.entries(t.input_schema.properties || {})
      .map(([k, v]) => `    ${k}: ${(v as { description?: string }).description ?? ""}`)
      .join("\n")
    return `- ${t.name}: ${t.description}${params ? "\n" + params : ""}`
  }).join("\n")

  return `${SYSTEM_PROMPT}

## Tools
You have access to real-time financial data tools. When you need data, output ONLY a JSON tool call — no preamble, no explanation, just the JSON:
{"tool": "tool_name", "args": {"param": "value"}}

Rules:
- ALWAYS call a tool when the user asks about their financial data. Never say you lack access.
- When calling a tool, output ONLY the JSON. Do not write any text before or after it.
- After receiving tool results, answer naturally using that data in clean markdown. No JSON in your final answer.
- Be concise. Use bullet points, tables, and bold for readability.

Available tools:
${toolDescriptions}`
}

function buildUserMessage(
  messages: { role: string; content: string }[],
  toolContext: string[]
): string {
  let msg = ""
  for (const m of messages) {
    msg += `${m.role === "user" ? "User" : "Assistant"}: ${m.content}\n\n`
  }
  if (toolContext.length > 0) {
    msg += "Tool results from this conversation turn:\n" + toolContext.join("\n") + "\n\nNow answer the user's question using the tool results above.\n"
  }
  return msg.trim()
}

/** Remove any tool call JSON blocks from a response string */
function stripToolJSON(text: string): string {
  // Find and remove JSON objects containing "tool" key (handles nested braces)
  const toolIdx = text.indexOf('"tool"')
  if (toolIdx < 0) return text.trim()

  const start = text.lastIndexOf("{", toolIdx)
  if (start < 0) return text.trim()

  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++
    else if (text[i] === "}") {
      depth--
      if (depth === 0) {
        return (text.slice(0, start) + text.slice(i + 1)).trim()
      }
    }
  }
  return text.trim()
}

function parseToolCall(text: string): { tool: string; args: Record<string, unknown> } | null {
  // Find "tool" key and walk outward to find the complete JSON object
  const toolIdx = text.indexOf('"tool"')
  if (toolIdx < 0) return null

  const start = text.lastIndexOf("{", toolIdx)
  if (start < 0) return null

  // Walk forward, counting brace depth to find the matching close
  let depth = 0
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++
    else if (text[i] === "}") {
      depth--
      if (depth === 0) {
        try {
          const obj = JSON.parse(text.slice(start, i + 1))
          if (typeof obj.tool === "string" && TOOL_DEFINITIONS.some((t) => t.name === obj.tool)) {
            return { tool: obj.tool, args: obj.args ?? {} }
          }
        } catch { /* not valid JSON */ }
        break
      }
    }
  }
  return null
}
