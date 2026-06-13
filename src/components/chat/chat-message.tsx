"use client"

import { useState, useMemo } from "react"
import { marked } from "marked"
import DOMPurify from "dompurify"
import type { ChatMessage } from "@/lib/chat/types"
import { extractFencePayload, parseToolResult } from "./result-payload"
import { ResultPayloadView } from "./result-payload-view"

marked.setOptions({ breaks: true, gfm: true })

/**
 * Strip a STRAY leading code fence that would otherwise swallow the whole message
 * as one code block. This happens when the model wraps its prose in ```markdown
 * (or a bare ```), or when extracting a `pocket:*` payload fence leaves the prose
 * with an unbalanced opening fence. Only acts when fences are unbalanced (odd
 * count) and the opener is bare / markdown — never touches a real ```js block.
 */
function normalizeFences(text: string): string {
  const fenceCount = (text.match(/^```/gm) || []).length
  if (fenceCount % 2 === 0) return text
  return text.replace(/^\s*```(?:markdown|md)?[ \t]*\n/i, "")
}

/** Renders markdown to sanitized HTML — DOMPurify prevents XSS */
function renderMarkdown(text: string): string {
  return DOMPurify.sanitize(marked.parse(normalizeFences(text || "")) as string)
}

/**
 * Assistant content: if it contains a `pocket:flights` / `pocket:hotels` fence,
 * render rich carousels around the surrounding markdown. Otherwise fall through
 * to the plain DOMPurify markdown path. Card fields are React text nodes only —
 * never injected as HTML.
 */
function AssistantContent({ content }: { content: string }) {
  const fenced = useMemo(() => extractFencePayload(content), [content])

  const beforeHtml = useMemo(
    () => (fenced ? renderMarkdown(fenced.before) : ""),
    [fenced]
  )
  const afterHtml = useMemo(
    () => (fenced ? renderMarkdown(fenced.after) : ""),
    [fenced]
  )
  const fullHtml = useMemo(
    () => (fenced ? "" : renderMarkdown(content)),
    [fenced, content]
  )

  if (!fenced) {
    // Content is sanitized via DOMPurify.sanitize() in renderMarkdown above.
    return <div className="llm-content break-words" dangerouslySetInnerHTML={{ __html: fullHtml }} />
  }

  return (
    <div className="break-words">
      {fenced.before && (
        <div className="llm-content" dangerouslySetInnerHTML={{ __html: beforeHtml }} />
      )}
      <ResultPayloadView payload={fenced.payload} />
      {fenced.after && (
        <div className="llm-content mt-1" dangerouslySetInnerHTML={{ __html: afterHtml }} />
      )}
    </div>
  )
}

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

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
          <AssistantContent content={message.content} />
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

  // Structured flight/hotel results render as rich carousels instead of raw JSON.
  const payload = useMemo(() => (status === "done" ? parseToolResult(result) : null), [result, status])

  const statusChip = (
    <div className="flex items-center gap-1.5">
      <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
        {status === "running" ? "hourglass_top" : status === "error" ? "error" : "check_circle"}
      </span>
      <span className="text-foreground-muted capitalize">{label}</span>
      {status === "running" && (
        <span className="text-foreground-muted animate-pulse ml-auto">running...</span>
      )}
    </div>
  )

  if (payload) {
    return (
      <div className="text-xs">
        <div className="px-2.5 py-1.5">{statusChip}</div>
        <ResultPayloadView payload={payload} />
      </div>
    )
  }

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
