/**
 * React hook binding for the PocketLLM chat store.
 * Uses useSyncExternalStore for navigation-persistent state.
 */

import { useSyncExternalStore } from "react"
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  sendMessage,
  abortStream,
  newThread,
  switchThread,
  deleteThread,
  togglePanel,
  closePanel,
  openPanel,
} from "@/lib/chat/store"

export function useChat() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const activeThread = state.threads.find((t) => t.id === state.activeThreadId) ?? null
  const messages = activeThread?.messages ?? []

  return {
    messages,
    status: state.status,
    activeThread,
    threads: state.threads,
    isOpen: state.isOpen,
    sendMessage,
    abortStream,
    newThread,
    switchThread,
    deleteThread,
    togglePanel,
    closePanel,
    openPanel,
  }
}
