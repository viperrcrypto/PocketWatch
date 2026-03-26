/**
 * Multi-provider AI dispatcher for financial analysis.
 * Routes to Claude CLI, Claude API, OpenAI, or Gemini based on configuration.
 */

import { execFile, spawn } from "child_process"
import { promisify } from "util"
import { existsSync } from "fs"
import type { AIInsightsResponse } from "./ai-prompt"

const execFileAsync = promisify(execFile)

/** Resolve the `claude` binary path, checking common locations if not in PATH. */
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
  return "claude" // fall back to PATH
}

/** Check if Claude CLI binary is available on this machine. */
export async function detectClaudeCLI(): Promise<boolean> {
  const bin = resolveClaudeBin()
  if (bin !== "claude") return true
  try {
    await execFileAsync("which", ["claude"], { timeout: 3_000 })
    return true
  } catch {
    return false
  }
}

export type AIProviderType = "ai_claude_cli" | "ai_claude_api" | "ai_openai" | "ai_gemini"

export interface AIProviderConfig {
  provider: AIProviderType
  apiKey: string // "enabled" for CLI, actual key for APIs
  model?: string
}

const PROVIDER_LABELS: Record<AIProviderType, string> = {
  ai_claude_cli: "Claude CLI",
  ai_claude_api: "Claude API",
  ai_openai: "OpenAI",
  ai_gemini: "Gemini",
}

export function getProviderLabel(provider: AIProviderType): string {
  return PROVIDER_LABELS[provider] ?? provider
}

/**
 * Call the configured AI provider with a prompt.
 * Returns structured insights or throws on failure.
 */
export async function callAIProvider(
  config: AIProviderConfig,
  prompt: string
): Promise<AIInsightsResponse> {
  const rawText = await dispatchToProvider(config, prompt)
  return parseAIResponse(rawText)
}

/**
 * Call the configured AI provider and return raw text response.
 * Use this when you need a custom response schema (e.g. budget analysis).
 */
export async function callAIProviderRaw(
  config: AIProviderConfig,
  prompt: string
): Promise<string> {
  return dispatchToProvider(config, prompt)
}

async function dispatchToProvider(config: AIProviderConfig, prompt: string): Promise<string> {
  switch (config.provider) {
    case "ai_claude_cli":
      return callClaudeCLI(prompt, config.model)
    case "ai_claude_api":
      return callClaudeAPI(config.apiKey, prompt, config.model)
    case "ai_openai":
      return callOpenAI(config.apiKey, prompt, config.model)
    case "ai_gemini":
      return callGemini(config.apiKey, prompt, config.model)
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`)
  }
}

async function callClaudeCLI(prompt: string, model?: string): Promise<string> {
  const bin = resolveClaudeBin()
  return new Promise((resolve, reject) => {
    // Use spawn + stdin pipe instead of passing prompt as -p argument
    // to avoid OS argument length limits on long prompts
    // Strip all Claude Code env vars to avoid nested-session detection
    const { CLAUDECODE, CLAUDE_CODE, CLAUDE_CODE_ENTRYPOINT, ...cleanEnv } = process.env
    const args = ["-p", "--output-format", "text"]
    if (model) args.push("--model", model)
    const child = spawn(bin, args, {
      env: { ...cleanEnv, TERM: "dumb" },
      stdio: ["pipe", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString() })
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString() })

    let killed = false
    const timer = setTimeout(() => {
      killed = true
      child.kill("SIGTERM")
      // SIGKILL fallback if SIGTERM doesn't work after 5s
      setTimeout(() => { try { child.kill("SIGKILL") } catch { /* already dead */ } }, 5_000)
      reject(new Error("Claude CLI timed out after 180s"))
    }, 180_000)

    child.on("close", (code) => {
      clearTimeout(timer)
      if (killed) return // already rejected by timeout
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(`Claude CLI exited with code ${code}: ${(stderr || stdout).slice(0, 500)}`))
    })

    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      if (err.code === "ENOENT") {
        reject(new Error(`Claude CLI not found at "${bin}". Install: npm install -g @anthropic-ai/claude-code`))
      } else {
        reject(new Error(`Claude CLI failed: ${err.message}`))
      }
    })

    child.stdin.write(prompt)
    child.stdin.end()
  })
}

async function callClaudeAPI(apiKey: string, prompt: string, model?: string): Promise<string> {
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
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Claude API error ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.content?.[0]?.text
  if (!text) throw new Error("Empty response from Claude API")
  return text
}

async function callOpenAI(apiKey: string, prompt: string, model?: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model ?? "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`OpenAI API error ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error("Empty response from OpenAI")
  return text
}

async function callGemini(apiKey: string, prompt: string, model?: string): Promise<string> {
  const geminiModel = model ?? "gemini-2.0-flash"
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 2048,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error("Empty response from Gemini")
  return text
}

/**
 * Parse raw AI text response into structured format.
 * If JSON parse fails, wraps the raw text as a key insight.
 */
function parseAIResponse(rawText: string): AIInsightsResponse {
  // Try to extract JSON from the response (handles markdown code blocks)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        keyInsight: parsed.keyInsight ?? { title: "Analysis Complete", description: rawText.slice(0, 200) },
        savingsOpportunities: Array.isArray(parsed.savingsOpportunities) ? parsed.savingsOpportunities : [],
        budgetRecommendations: Array.isArray(parsed.budgetRecommendations) ? parsed.budgetRecommendations : [],
        subscriptionReview: Array.isArray(parsed.subscriptionReview) ? parsed.subscriptionReview : [],
        anomalyComments: Array.isArray(parsed.anomalyComments) ? parsed.anomalyComments : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: wrap raw text as key insight
  return {
    keyInsight: { title: "AI Analysis", description: rawText.slice(0, 200) },
    savingsOpportunities: [],
    budgetRecommendations: [],
    subscriptionReview: [],
    anomalyComments: [],
    actionItems: [],
  }
}

/**
 * Verify a provider is reachable.
 * For CLI: checks if `claude` binary exists.
 * For APIs: makes a minimal test call.
 */
export async function verifyProvider(config: AIProviderConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (config.provider) {
      case "ai_claude_cli": {
        const bin = resolveClaudeBin()
        if (bin === "claude") {
          await execFileAsync("which", ["claude"], { timeout: 5_000 })
        } else if (!existsSync(bin)) {
          return { ok: false, error: `Claude CLI not found at ${bin}` }
        }
        // Test with the selected model by making a real call
        try {
          const args = ["-p", "--output-format", "text"]
          if (config.model) args.push("--model", config.model)
          const { CLAUDECODE, CLAUDE_CODE, CLAUDE_CODE_ENTRYPOINT, ...cleanEnv } = process.env
          const { stdout } = await execFileAsync(bin, [...args, "Say hi in 2 words"], {
            timeout: 15_000,
            env: { ...cleanEnv, TERM: "dumb" },
          })
          if (!stdout.trim()) return { ok: false, error: "CLI returned empty response" }
          return { ok: true }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          return { ok: false, error: `CLI test failed: ${msg.slice(0, 100)}` }
        }
      }
      case "ai_claude_api": {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: config.model ?? "claude-sonnet-4-20250514",
            max_tokens: 10,
            messages: [{ role: "user", content: "hi" }],
          }),
          signal: AbortSignal.timeout(30_000),
        })
        if (!res.ok) {
          const body = await res.text().catch(() => "")
          return { ok: false, error: `API returned ${res.status}: ${body.slice(0, 100)}` }
        }
        return { ok: true }
      }
      case "ai_openai": {
        const openaiModel = config.model ?? "gpt-4o-mini"
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: openaiModel,
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 5,
          }),
          signal: AbortSignal.timeout(30_000),
        })
        if (!res.ok) {
          const body = await res.text().catch(() => "")
          return { ok: false, error: `${openaiModel}: API returned ${res.status}: ${body.slice(0, 100)}` }
        }
        return { ok: true }
      }
      case "ai_gemini": {
        const geminiModel = config.model ?? "gemini-2.0-flash"
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${config.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "hi" }] }],
              generationConfig: { maxOutputTokens: 5 },
            }),
            signal: AbortSignal.timeout(30_000),
          }
        )
        if (!res.ok) {
          const body = await res.text().catch(() => "")
          return { ok: false, error: `${geminiModel}: API returned ${res.status}: ${body.slice(0, 100)}` }
        }
        return { ok: true }
      }
      default:
        return { ok: false, error: "Unknown provider" }
    }
  } catch (err: unknown) {
    // Detect AbortSignal timeout — Node.js throws DOMException with name "TimeoutError"
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return { ok: false, error: "Connection timed out — try again or check your network" }
    }
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}
