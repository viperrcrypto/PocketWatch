/** PocketLLM chat API — SSE streaming with agentic tool loop. */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { resolveProvider, runAgentLoop } from "@/lib/chat/agent-loop"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const MAX_HISTORY_MESSAGES = 20

interface ChatRequestBody {
  messages: { role: "user" | "assistant"; content: string }[]
  threadId: string
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError("C1000", "Authentication required", 401)

  // Resolve AI provider (auto-detects Claude CLI if no provider configured)
  let provider
  try {
    provider = await resolveProvider(user.id)
  } catch (err) {
    return apiError("C1001", (err as Error).message, 400)
  }

  let body: ChatRequestBody
  try {
    body = await req.json()
  } catch {
    return apiError("C1003", "Invalid request body", 400)
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return apiError("C1004", "Messages array is required", 400)
  }

  const messages = body.messages.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        await runAgentLoop(provider, messages, user.id, send)
        send("done", {})
      } catch (err) {
        send("error", { error: (err as Error).message || "Stream failed" })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
