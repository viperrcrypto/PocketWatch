"use client"

import { useState } from "react"
import { FeedbackModal } from "./feedback-modal"
import { toast } from "sonner"

export function FeedbackButton() {
  const [showModal, setShowModal] = useState(false)

  function handleSuccess() {
    toast.success("Thank you for your feedback!")
    setShowModal(false)
  }

  return (
    <>
      {/* Fixed feedback button in bottom-right corner */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 text-xs font-medium transition-all hover:opacity-90 bg-primary text-foreground rounded-lg"
        style={{
          boxShadow: "0 4px 12px rgba(88, 101, 242, 0.3)",
        }}
      >
        <span className="material-symbols-rounded text-sm">rate_review</span>
        Feedback
      </button>

      <FeedbackModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
      />
    </>
  )
}
