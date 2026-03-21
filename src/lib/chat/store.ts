/**
 * Module-level chat store — state lives outside React's component lifecycle
 * so it survives Next.js page navigation. Binds to React via useSyncExternalStore.
 */

import type { ChatMessage, ChatThread, ChatStatus, ChatStoreState } from "./types"

const STORAGE_KEY = "pocketllm-threads"
const MAX_THREADS = 20
const MAX_MESSAGES = 50

// ─── Module State ──────────────────────────────────────────────

let threads: ChatThread[] = []
let activeThreadId: string | null = null
let status: ChatStatus = "idle"
let isOpen = false
let abortController: AbortController | null = null
const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | null = null

// Load from localStorage on module init
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as ChatThread[]
      threads = saved.slice(0, MAX_THREADS)
      if (threads.length > 0) activeThreadId = threads[0].id
    }
  } catch { /* ignore corrupt storage */ }
}

// ─── Internal Helpers ──────────────────────────────────────────

function notify() {
  cachedSnapshot = { threads, activeThreadId, status, isOpen }
  for (const fn of listeners) fn()
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(threads))
    } catch { /* quota exceeded */ }
  }, 500)
}

function getActiveThread(): ChatThread | undefined {
  return threads.find((t) => t.id === activeThreadId)
}

function generateId(): string {
  return crypto.randomUUID()
}

function threadTitle(msg: string): string {
  return msg.slice(0, 50) + (msg.length > 50 ? "..." : "")
}

// ─── useSyncExternalStore bindings ─────────────────────────────

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

let cachedSnapshot: ChatStoreState = { threads, activeThreadId, status, isOpen }

export function getSnapshot(): ChatStoreState {
  return cachedSnapshot
}

const SERVER_SNAPSHOT: ChatStoreState = { threads: [], activeThreadId: null, status: "idle", isOpen: false }

export function getServerSnapshot(): ChatStoreState {
  return SERVER_SNAPSHOT
}

// ─── Actions ───────────────────────────────────────────────────

export function togglePanel() {
  isOpen = !isOpen
  notify()
}

export function closePanel() {
  isOpen = false
  notify()
}

export function openPanel() {
  isOpen = true
  notify()
}

export function newThread(): string {
  const id = generateId()
  const thread: ChatThread = {
    id,
    title: "New chat",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  threads = [thread, ...threads].slice(0, MAX_THREADS)
  activeThreadId = id
  status = "idle"
  persist()
  notify()
  return id
}

export function switchThread(id: string) {
  if (threads.some((t) => t.id === id)) {
    activeThreadId = id
    status = "idle"
    notify()
  }
}

export function deleteThread(id: string) {
  threads = threads.filter((t) => t.id !== id)
  if (activeThreadId === id) {
    activeThreadId = threads[0]?.id ?? null
  }
  status = "idle"
  persist()
  notify()
}

export function abortStream() {
  abortController?.abort()
  abortController = null
  status = "idle"
  notify()
}

export async function sendMessage(content: string) {
  // Ensure we have an active thread
  if (!activeThreadId || !getActiveThread()) {
    newThread()
  }

  const thread = getActiveThread()!
  const userMsg: ChatMessage = {
    id: generateId(),
    role: "user",
    content,
    createdAt: Date.now(),
  }

  // Update thread title from first user message
  if (thread.messages.length === 0) {
    thread.title = threadTitle(content)
  }

  thread.messages = [...thread.messages, userMsg].slice(-MAX_MESSAGES)
  thread.updatedAt = Date.now()
  status = "streaming"
  persist()
  notify()

  // Prepare assistant message (will be progressively updated)
  const assistantMsg: ChatMessage = {
    id: generateId(),
    role: "assistant",
    content: "",
    toolCalls: [],
    createdAt: Date.now(),
  }
  thread.messages = [...thread.messages, assistantMsg].slice(-MAX_MESSAGES)
  notify()

  // Start SSE stream
  abortController?.abort()
  const controller = new AbortController()
  abortController = controller

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: thread.messages.slice(0, -1).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        threadId: thread.id,
      }),
      signal: controller.signal,
    })

    if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream")) {
      const body = await res.json().catch(() => ({ error: `Request failed: ${res.status}` }))
      assistantMsg.content = body.error ?? "Something went wrong."
      status = "error"
      persist()
      notify()
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      assistantMsg.content = "No response stream."
      status = "error"
      persist()
      notify()
      return
    }

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const lastDoubleNewline = buffer.lastIndexOf("\n\n")
      if (lastDoubleNewline < 0) continue

      const completePart = buffer.slice(0, lastDoubleNewline + 2)
      buffer = buffer.slice(lastDoubleNewline + 2)

      const events = parseSSE(completePart)
      for (const evt of events) {
        switch (evt.event) {
          case "text_delta": {
            const data = JSON.parse(evt.data) as { content: string }
            assistantMsg.content += data.content
            notify()
            break
          }
          case "text_replace": {
            const data = JSON.parse(evt.data) as { content: string }
            assistantMsg.content = data.content
            notify()
            break
          }
          case "tool_start": {
            const data = JSON.parse(evt.data) as { name: string; input: Record<string, unknown> }
            assistantMsg.toolCalls = [
              ...(assistantMsg.toolCalls ?? []),
              { name: data.name, input: data.input, status: "running" },
            ]
            status = "tool_running"
            notify()
            break
          }
          case "tool_result": {
            const data = JSON.parse(evt.data) as { name: string; result: string }
            const calls = assistantMsg.toolCalls ?? []
            const idx = calls.findLastIndex((tc) => tc.name === data.name && tc.status === "running")
            if (idx >= 0) {
              calls[idx] = { ...calls[idx], result: data.result, status: "done" }
              assistantMsg.toolCalls = [...calls]
            }
            status = "streaming"
            notify()
            break
          }
          case "done": {
            status = "idle"
            persist()
            notify()
            break
          }
          case "error": {
            const data = JSON.parse(evt.data) as { error: string }
            if (!assistantMsg.content) assistantMsg.content = data.error
            status = "error"
            persist()
            notify()
            break
          }
        }
      }
    }

    // Handle remaining buffer
    if (buffer.trim()) {
      const events = parseSSE(buffer)
      for (const evt of events) {
        if (evt.event === "done") {
          status = "idle"
        } else if (evt.event === "error") {
          const data = JSON.parse(evt.data) as { error: string }
          if (!assistantMsg.content) assistantMsg.content = data.error
          status = "error"
        }
      }
    }

    // If stream ended without explicit done/error
    if (status === "streaming" || status === "tool_running") {
      status = "idle"
    }
    persist()
    notify()
  } catch (err) {
    if ((err as Error).name === "AbortError") return
    assistantMsg.content = assistantMsg.content || "Connection failed. Try again."
    status = "error"
    persist()
    notify()
  } finally {
    if (abortController === controller) abortController = null
  }
}

// ─── SSE Parser ────────────────────────────────────────────────

function parseSSE(chunk: string): { event: string; data: string }[] {
  const events: { event: string; data: string }[] = []
  const blocks = chunk.split("\n\n").filter(Boolean)
  for (const block of blocks) {
    let event = ""
    let data = ""
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7)
      else if (line.startsWith("data: ")) data = line.slice(6)
    }
    if (event && data) events.push({ event, data })
  }
  return events
}
