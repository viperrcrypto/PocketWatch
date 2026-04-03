"use client"

import { useChat } from "@/hooks/use-chat"

export function ChatToggle() {
  const { togglePanel, isOpen, status } = useChat()

  return (
    <button
      onClick={togglePanel}
      className="fixed bottom-20 right-4 z-40 lg:bottom-6 w-12 h-12 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:brightness-110 transition-colors active:scale-95"
      aria-label={isOpen ? "Close chat" : "Open chat"}
    >
      <span className="material-symbols-rounded text-xl" aria-hidden="true">
        {isOpen ? "close" : "chat"}
      </span>
      {(status === "streaming" || status === "tool_running") && !isOpen && (
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 animate-pulse" />
      )}
    </button>
  )
}
