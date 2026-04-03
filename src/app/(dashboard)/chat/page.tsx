"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useChat } from "@/hooks/use-chat"
import { ChatMessageBubble } from "@/components/chat/chat-message"

export default function ChatPage() {
  const {
    messages, status, activeThread, threads,
    sendMessage, abortStream, newThread,
    switchThread, deleteThread, openPanel,
  } = useChat()

  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || status === "streaming" || status === "tool_running") return
    setInput("")
    sendMessage(trimmed)
  }, [input, status, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const isStreaming = status === "streaming" || status === "tool_running"

  return (
    <div className="flex gap-4 h-[calc(100vh-7rem)] max-h-[calc(100vh-7rem)]">
      {/* Thread sidebar — desktop only */}
      <div className="hidden lg:flex flex-col w-64 shrink-0 card border border-card-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 h-12 border-b border-card-border shrink-0">
          <span className="text-xs font-medium text-foreground-muted uppercase tracking-wider">Threads</span>
          <button
            onClick={newThread}
            className="p-1 rounded hover:bg-card-hover transition-colors"
            aria-label="New chat"
          >
            <span className="material-symbols-rounded text-lg">add</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {threads.length === 0 ? (
            <p className="text-xs text-foreground-muted text-center py-6">No threads yet</p>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => switchThread(thread.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors group ${
                  thread.id === activeThread?.id
                    ? "bg-primary-muted text-foreground"
                    : "text-foreground-muted hover:bg-card-hover hover:text-foreground"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{thread.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteThread(thread.id) }}
                    className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-background-secondary transition-opacity"
                    aria-label="Delete thread"
                  >
                    <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 14 }}>close</span>
                  </button>
                </div>
                <span className="text-[11px] text-foreground-muted">
                  {new Date(thread.updatedAt).toLocaleDateString()}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col card border border-card-border rounded-xl overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-card-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-rounded text-lg text-foreground-muted">smart_toy</span>
            <span className="text-sm font-medium truncate">
              {activeThread?.title ?? "PocketLLM"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Mobile: new thread + open sidebar panel */}
            <button
              onClick={newThread}
              className="lg:hidden p-1.5 rounded hover:bg-card-hover transition-colors"
              aria-label="New chat"
            >
              <span className="material-symbols-rounded text-lg">add</span>
            </button>
            <button
              onClick={openPanel}
              className="p-1.5 rounded hover:bg-card-hover transition-colors"
              aria-label="Open chat panel"
              title="Open floating chat panel"
            >
              <span className="material-symbols-rounded text-lg">open_in_new</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
          {messages.length === 0 ? (
            <FullPageEmptyState />
          ) : (
            <div className="max-w-3xl mx-auto">
              {messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} />
              ))}

              {/* Streaming indicator */}
              {isStreaming && messages[messages.length - 1]?.role === "assistant" &&
                !messages[messages.length - 1]?.content && (
                  <div className="flex justify-start mb-3">
                    <div className="bg-card border border-card-border rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-foreground-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-foreground-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-foreground-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-card-border px-4 md:px-6 py-3">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances..."
              rows={1}
              className="flex-1 resize-none bg-card border border-card-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors placeholder:text-foreground-muted max-h-32"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <button
                onClick={abortStream}
                className="shrink-0 w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                aria-label="Stop"
              >
                <span className="material-symbols-rounded text-lg">stop</span>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="shrink-0 w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-colors"
                aria-label="Send"
              >
                <span className="material-symbols-rounded text-lg">send</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FullPageEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <span className="material-symbols-rounded text-5xl text-foreground-muted mb-4">smart_toy</span>
      <h2 className="text-lg font-semibold mb-2">PocketLLM</h2>
      <p className="text-sm text-foreground-muted max-w-sm mb-6">
        Your AI financial assistant. Ask about spending, budgets, net worth, investments, credit cards, and more.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md w-full">
        {SUGGESTIONS.map((s) => (
          <div
            key={s}
            className="text-xs text-foreground-muted bg-card border border-card-border rounded-lg px-3 py-2 text-left"
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  )
}

const SUGGESTIONS = [
  "What's my net worth right now?",
  "How much did I spend on food this month?",
  "Am I over budget on any categories?",
  "Show me my active subscriptions",
]
