"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { useChat } from "@/hooks/use-chat"
import { ChatMessageBubble } from "./chat-message"
import { ThreadList } from "./thread-list"

export function ChatPanel() {
  const {
    messages, status, activeThread, threads,
    isOpen, sendMessage, abortStream, newThread,
    switchThread, deleteThread, closePanel,
  } = useChat()

  const pathname = usePathname()
  const [input, setInput] = useState("")
  const [showThreads, setShowThreads] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

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

  // Hide floating panel on the full-page chat route to avoid duplicate inputs
  if (!isOpen || pathname === "/chat") return null

  const isStreaming = status === "streaming" || status === "tool_running"

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 md:hidden"
        onClick={closePanel}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full md:w-[400px] bg-background border-l border-card-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-card-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setShowThreads(!showThreads)}
              className="touch-target rounded-lg hover:bg-card-hover transition-colors"
              aria-label="Thread history"
            >
              <span className="material-symbols-rounded text-lg">history</span>
            </button>
            <span className="text-sm font-medium truncate">
              {activeThread?.title ?? "PocketLLM"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={newThread}
              className="touch-target rounded-lg hover:bg-card-hover transition-colors"
              aria-label="New chat"
            >
              <span className="material-symbols-rounded text-lg">add</span>
            </button>
            <button
              onClick={closePanel}
              className="touch-target rounded-lg hover:bg-card-hover transition-colors"
              aria-label="Close chat"
            >
              <span className="material-symbols-rounded text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Thread list dropdown */}
        {showThreads && (
          <div className="border-b border-card-border bg-card">
            <ThreadList
              threads={threads}
              activeThreadId={activeThread?.id ?? null}
              onSwitch={switchThread}
              onDelete={deleteThread}
              onClose={() => setShowThreads(false)}
            />
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((msg, i) => {
              // Skip empty assistant message while streaming — loading indicator handles it
              if (isStreaming && msg.role === "assistant" && !msg.content && i === messages.length - 1) return null
              return <ChatMessageBubble key={msg.id} message={msg} />
            })
          )}

          {/* Streaming indicator */}
          {isStreaming && messages[messages.length - 1]?.role === "assistant" &&
            !messages[messages.length - 1]?.content && (
              <div className="flex justify-start mb-3">
                <div className="bg-card border border-card-border rounded-2xl rounded-bl-md px-4 py-2.5">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-foreground-muted animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-foreground-muted animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-foreground-muted animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-card-border px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances..."
              rows={1}
              className="flex-1 resize-none bg-card border border-card-border rounded-xl px-3 py-2.5 text-base md:text-sm outline-none focus:border-primary transition-colors placeholder:text-foreground-muted max-h-32"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <button
                onClick={abortStream}
                className="shrink-0 w-11 h-11 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                aria-label="Stop"
              >
                <span className="material-symbols-rounded text-lg">stop</span>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="shrink-0 w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-colors"
                aria-label="Send"
              >
                <span className="material-symbols-rounded text-lg">send</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <span className="material-symbols-rounded text-4xl text-foreground-muted mb-3">smart_toy</span>
      <h3 className="text-sm font-medium mb-1">PocketLLM</h3>
      <p className="text-xs text-foreground-muted max-w-[260px]">
        Ask me anything about your finances — spending, budgets, net worth, investments, and more.
      </p>
    </div>
  )
}
