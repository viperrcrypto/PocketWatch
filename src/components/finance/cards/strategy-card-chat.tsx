"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useCardAsk } from "@/hooks/finance/use-credit-cards"

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
  return html.replace(/<\/?[^>]+>/g, (tag) => ALLOWED_TAGS.test(tag) ? tag : "")
}

interface Message {
  role: "user" | "assistant"
  content: string
}

interface CardOption {
  id: string
  name: string
  imageUrl?: string | null
}

interface StrategyCardChatProps {
  cards: CardOption[]
}

const SUGGESTED = [
  "Which card should I use for groceries?",
  "How do I maximize travel rewards?",
  "What purchase protections do my cards have?",
  "Which card has the best dining rewards?",
]

export function StrategyCardChat({ cards }: StrategyCardChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [selectedCardId, setSelectedCardId] = useState<string>(cards[0]?.id ?? "")
  const askMutation = useCardAsk()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const selectedCard = cards.find((c) => c.id === selectedCardId)

  const handleSend = (question?: string) => {
    const q = (question ?? input).trim()
    if (!q || askMutation.isPending || !selectedCardId) return

    const userMsg: Message = { role: "user", content: q }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput("")

    askMutation.mutate(
      { cardProfileId: selectedCardId, question: q, history: updated.slice(-6) },
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
    <div className="bg-card border border-card-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="px-5 py-3 border-b border-card-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 16 }}>chat</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
            Ask About Your Cards
          </span>
        </div>
        {/* Card selector */}
        {cards.length > 1 && (
          <div className="flex items-center gap-2">
            {selectedCard?.imageUrl && (
              <img src={selectedCard.imageUrl} alt="" className="w-6 h-4 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
            )}
            <select
              value={selectedCardId}
              onChange={(e) => setSelectedCardId(e.target.value)}
              className="text-[10px] font-medium bg-background-secondary text-foreground-muted px-2 py-1 rounded-lg border-none outline-none cursor-pointer hover:bg-foreground/[0.08] transition-colors appearance-none pr-5 max-w-[160px] truncate"
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <span className="material-symbols-rounded text-foreground-muted/50 -ml-5 pointer-events-none" style={{ fontSize: 12 }}>
              expand_more
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div ref={scrollRef} className="max-h-[350px] overflow-y-auto p-4 space-y-3">
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

      {/* Suggested questions */}
      {messages.length === 0 && (
        <div className="p-4">
          <p className="text-[11px] text-foreground-muted mb-2.5">
            Ask anything about {selectedCard?.name ?? "your cards"}:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                disabled={askMutation.isPending}
                className="text-[10px] px-2.5 py-1.5 rounded-lg border border-card-border text-foreground-muted hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors disabled:opacity-50"
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
          placeholder={`Ask about ${selectedCard?.name ?? "your cards"}...`}
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
              : "bg-background-secondary text-foreground-muted cursor-not-allowed"
          )}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>send</span>
        </button>
      </div>
    </div>
  )
}
