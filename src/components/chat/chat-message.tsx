"use client"

import { useState, useMemo } from "react"
import { marked } from "marked"
import DOMPurify from "dompurify"
import type { ChatMessage } from "@/lib/chat/types"

marked.setOptions({ breaks: true, gfm: true })

/** Renders markdown to sanitized HTML — DOMPurify prevents XSS */
function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(text || "") as string)
}

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  const html = useMemo(() => {
    if (isUser) return ""
    return renderMarkdown(message.content)
  }, [isUser, message.content])

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-white rounded-br-md"
            : "bg-card border border-card-border rounded-bl-md"
        }`}
      >
        {/* Message content */}
        {isUser ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          // Content is sanitized via DOMPurify.sanitize() in renderMarkdown above
          <div
            className="llm-content break-words"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.toolCalls.map((tc, i) => (
              <ToolCallBlock key={i} name={tc.name} result={tc.result} status={tc.status} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolCallBlock({ name, result, status }: { name: string; result?: string; status: string }) {
  const [expanded, setExpanded] = useState(false)

  const label = name.replace(/^get_/, "").replaceAll("_", " ")

  return (
    <button
      onClick={() => result && setExpanded(!expanded)}
      className="w-full text-left text-xs bg-background/50 rounded-lg px-2.5 py-1.5 border border-card-border/50"
    >
      <div className="flex items-center gap-1.5">
        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
          {status === "running" ? "hourglass_top" : status === "error" ? "error" : "check_circle"}
        </span>
        <span className="text-foreground-muted capitalize">{label}</span>
        {status === "running" && (
          <span className="text-foreground-muted animate-pulse ml-auto">running...</span>
        )}
        {result && (
          <span className="material-symbols-rounded ml-auto text-foreground-muted" style={{ fontSize: 12 }}>
            {expanded ? "expand_less" : "expand_more"}
          </span>
        )}
      </div>
      {expanded && result && (
        <pre className="mt-1.5 text-[11px] text-foreground-muted overflow-x-auto max-h-32 whitespace-pre-wrap">
          {formatToolResult(result)}
        </pre>
      )}
    </button>
  )
}

function formatToolResult(result: string): string {
  try {
    return JSON.stringify(JSON.parse(result), null, 2)
  } catch {
    return result
  }
}
