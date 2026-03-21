/**
 * Type definitions for PocketLLM chat system.
 */

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  toolCalls?: ToolCall[]
  createdAt: number
}

export interface ToolCall {
  name: string
  input: Record<string, unknown>
  result?: string
  status: "running" | "done" | "error"
}

export interface ChatThread {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

export type ChatStatus = "idle" | "streaming" | "tool_running" | "error"

export interface ChatStoreState {
  threads: ChatThread[]
  activeThreadId: string | null
  status: ChatStatus
  isOpen: boolean
}
