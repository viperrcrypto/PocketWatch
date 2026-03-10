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

export type AIProviderType = "ai_claude_cli" | "ai_claude_api" | "ai_openai" | "ai_gemini"

export interface AIProviderConfig {
  provider: AIProviderType
  apiKey: string // "enabled" for CLI, actual key for APIs
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
      return callClaudeCLI(prompt)
    case "ai_claude_api":
      return callClaudeAPI(config.apiKey, prompt)
    case "ai_openai":
      return callOpenAI(config.apiKey, prompt)
    case "ai_gemini":
      return callGemini(config.apiKey, prompt)
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`)
  }
}

async function callClaudeCLI(prompt: string): Promise<string> {
  const bin = resolveClaudeBin()
  return new Promise((resolve, reject) => {
    // Use spawn + stdin pipe instead of passing prompt as -p argument
    // to avoid OS argument length limits on long prompts
    // Strip CLAUDECODE/CLAUDE_CODE to avoid nested-session detection
    const { CLAUDECODE, CLAUDE_CODE, ...cleanEnv } = process.env
    const child = spawn(bin, ["-p", "--output-format", "text"], {
      env: { ...cleanEnv, TERM: "dumb" },
      stdio: ["pipe", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString() })
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString() })

    const timer = setTimeout(() => {
      child.kill("SIGTERM")
      reject(new Error("Claude CLI timed out after 120s"))
    }, 120_000)

    child.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(`Claude CLI exited with code ${code}: ${stderr.slice(0, 500)}`))
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

async function callClaudeAPI(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
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

async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 2048,
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

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

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
          // Not found in known locations, try PATH as last resort
          await execFileAsync("which", ["claude"], { timeout: 5_000 })
        } else if (!existsSync(bin)) {
          return { ok: false, error: `Claude CLI not found at ${bin}` }
        }
        return { ok: true }
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
            model: "claude-sonnet-4-20250514",
            max_tokens: 10,
            messages: [{ role: "user", content: "hi" }],
          }),
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) {
          const body = await res.text().catch(() => "")
          return { ok: false, error: `API returned ${res.status}: ${body.slice(0, 100)}` }
        }
        return { ok: true }
      }
      case "ai_openai": {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${config.apiKey}` },
          signal: AbortSignal.timeout(10_000),
        })
        return res.ok ? { ok: true } : { ok: false, error: `API returned ${res.status}` }
      }
      case "ai_gemini": {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`,
          { signal: AbortSignal.timeout(10_000) }
        )
        return res.ok ? { ok: true } : { ok: false, error: `API returned ${res.status}` }
      }
      default:
        return { ok: false, error: "Unknown provider" }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}
