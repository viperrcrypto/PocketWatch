"use client";

import { useState, useEffect } from "react";
import { FeedbackModal } from "./feedback-modal";
import { toast } from "sonner";

const STORAGE_KEY = "trackme-feedback-banner-dismissed";

export function FeedbackBanner() {
  const [dismissed, setDismissed] = useState(true); // Start hidden to prevent flash
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the banner
    const isDismissed = localStorage.getItem(STORAGE_KEY);
    if (!isDismissed) {
      setDismissed(false);
    }
  }, []);

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  function handleSuccess() {
    toast.success("Thank you for your feedback!");
    handleDismiss();
  }

  if (dismissed) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-blue-600/90 to-purple-600/90 backdrop-blur-sm">
        <div className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="material-symbols-rounded text-white/90 text-lg flex-shrink-0">
              rate_review
            </span>
            <p className="text-sm text-white/90 truncate">
              <span className="font-medium">We just launched!</span>
              {" "}Help us improve WealthTracker by sharing your feedback.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-background text-xs font-semibold rounded-md hover:bg-white/90 transition-colors"
            >
              <span className="material-symbols-rounded text-sm">feedback</span>
              Give Feedback
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 text-white/70 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <span className="material-symbols-rounded text-lg">close</span>
            </button>
          </div>
        </div>
      </div>

      <FeedbackModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
