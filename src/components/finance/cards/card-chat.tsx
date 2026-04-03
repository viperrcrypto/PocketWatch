"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useCardAsk } from "@/hooks/finance/use-credit-cards"
import type { CardAIEnrichedData } from "@/app/api/finance/cards/ai-enrich/route"

/** Render simple markdown (bold, lists, line breaks) as HTML.
 * HTML is escaped FIRST, then safe markdown tags are applied.
 * Final pass strips any tags not in the allowlist as defense-in-depth. */
const ALLOWED_TAGS = /^<\/?(strong|em|li|br)\b[^>]*>$/i
function renderMarkdown(text: string): string {
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n/g, "<br/>")
  // Strip any tags not in the explicit allowlist
  return html.replace(/<\/?[^>]+>/g, (tag) => ALLOWED_TAGS.test(tag) ? tag : "")
}

interface Message {
  role: "user" | "assistant"
  content: string
}

interface CardChatProps {
  cardId: string
  cardName: string
  aiData: CardAIEnrichedData | null
}

const SUGGESTED_QUESTIONS = [
  "What's the purchase protection coverage?",
  "What does the extended warranty cover?",
  "Does this card have return protection?",
  "What car rental insurance is included?",
]

export function CardChat({ cardId, cardName, aiData }: CardChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const askMutation = useCardAsk()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const handleSend = (question?: string) => {
    const q = (question ?? input).trim()
    if (!q || askMutation.isPending) return

    const userMsg: Message = { role: "user", content: q }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput("")

    askMutation.mutate(
      { cardProfileId: cardId, question: q, history: updatedMessages.slice(-6) },
      {
        onSuccess: (data) => {
          setMessages((prev) => [...prev, { role: "assistant", content: data.answer }])
        },
        onError: (err) => {
          setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }])
        },
      },
    )
  }

  return (
    <section className="mt-2">
      <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 22 }}>chat</span>
        Ask About This Card
      </h3>
      <div className="bg-card rounded-xl border border-card-border overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        {/* Messages */}
        {messages.length > 0 && (
          <div ref={scrollRef} className="max-h-[400px] overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-white"
                    : "bg-background-secondary text-foreground"
                )}>
                  {msg.role === "assistant"
                    ? <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    : msg.content}
                </div>
              </div>
            ))}
            {askMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-background-secondary rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <span className="material-symbols-rounded animate-spin text-primary" style={{ fontSize: 16 }}>progress_activity</span>
                  <span className="text-sm text-foreground-muted">Thinking...</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Suggested questions (show when no messages) */}
        {messages.length === 0 && (
          <div className="p-4 space-y-2">
            <p className="text-xs text-foreground-muted mb-2">Ask anything about your {cardName}:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  disabled={askMutation.isPending}
                  className="text-xs px-3 py-1.5 rounded-full border border-card-border text-foreground-muted hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-card-border/50 p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={`Ask about ${cardName}...`}
            disabled={askMutation.isPending}
            className="flex-1 bg-background-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-foreground-muted outline-none focus:ring-2 focus:ring-primary/30 transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || askMutation.isPending}
            className={cn(
              "px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5",
              input.trim() && !askMutation.isPending
                ? "bg-primary text-white hover:bg-primary-hover active:scale-95"
                : "bg-card-elevated text-foreground-muted cursor-not-allowed"
            )}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>send</span>
          </button>
        </div>
      </div>
    </section>
  )
}
