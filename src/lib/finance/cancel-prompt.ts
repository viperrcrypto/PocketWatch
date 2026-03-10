/**
 * Prompt builder for AI-powered subscription cancellation guidance.
 */

export interface CancelGuidance {
  steps: Array<{ step: number; instruction: string; url?: string }>
  estimatedTime: string
  difficulty: "easy" | "medium" | "hard"
  tips: string[]
}

export function buildCancelGuidancePrompt(
  merchantName: string,
  amount: number,
  frequency: string,
): string {
  return `You are a subscription cancellation expert. The user wants to cancel their "${merchantName}" subscription (${frequency}, $${amount.toFixed(2)}).

Provide specific cancellation instructions for this merchant.

Return ONLY valid JSON matching this exact structure:
{
  "steps": [
    { "step": 1, "instruction": "description of what to do", "url": "https://..." }
  ],
  "estimatedTime": "5-10 minutes",
  "difficulty": "easy" | "medium" | "hard",
  "tips": ["tip1", "tip2"]
}

Guidelines:
- Include direct URLs to account settings or cancellation pages when you know them
- Mention if the merchant requires calling customer support
- Warn about retention offers or cancellation fees
- Include tips about timing (e.g., cancel right after billing to keep access)
- Be specific to this merchant — don't give generic advice
- If you're not sure about the exact URL, omit the url field for that step
- Keep steps concise and actionable`
}

export function parseCancelGuidance(rawText: string): CancelGuidance | null {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) return null

    return {
      steps: parsed.steps.map((s: Record<string, unknown>, i: number) => ({
        step: typeof s.step === "number" ? s.step : i + 1,
        instruction: String(s.instruction ?? ""),
        ...(s.url ? { url: String(s.url) } : {}),
      })),
      estimatedTime: String(parsed.estimatedTime ?? "5-10 minutes"),
      difficulty: ["easy", "medium", "hard"].includes(parsed.difficulty) ? parsed.difficulty : "medium",
      tips: Array.isArray(parsed.tips) ? parsed.tips.map(String) : [],
    }
  } catch {
    return null
  }
}
