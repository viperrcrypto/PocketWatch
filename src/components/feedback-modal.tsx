"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function FeedbackModal({ isOpen, onClose, onSuccess }: FeedbackModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [likes, setLikes] = useState("");
  const [improvements, setImprovements] = useState("");
  const [bugs, setBugs] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          likes: likes.trim() || null,
          improvements: improvements.trim() || null,
          bugs: bugs.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");

      onSuccess();
      onClose();
    } catch {
      setError("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-background border border-card-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background px-6 py-4 border-b border-card-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Website Feedback
            </h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              Help us improve WealthTracker
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground transition-colors"
          >
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Rating */}
          <div>
            <label className="block text-sm font-medium mb-2">
              How would you rate this website? <span className="text-error">*</span>
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className={cn(
                    "flex-1 py-3 rounded-lg border text-center transition-all",
                    rating === value
                      ? "border-blue-500 bg-blue-500/10 text-blue-400"
                      : "border-card-border bg-card text-foreground-muted hover:border-card-border-hover"
                  )}
                >
                  <span className="text-lg">{value}</span>
                  <span className="block text-[10px] mt-0.5">
                    {value === 1 && "Poor"}
                    {value === 2 && "Fair"}
                    {value === 3 && "Good"}
                    {value === 4 && "Great"}
                    {value === 5 && "Amazing"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Likes */}
          <div>
            <label className="block text-sm font-medium mb-2">
              What features do you like most?
            </label>
            <textarea
              value={likes}
              onChange={(e) => setLikes(e.target.value)}
              placeholder="e.g. Forms, Updates feed, Calendar..."
              rows={2}
              className="w-full bg-card border border-card-border rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500 resize-none placeholder:text-foreground-muted"
            />
          </div>

          {/* Improvements */}
          <div>
            <label className="block text-sm font-medium mb-2">
              What features would you improve or add?
            </label>
            <textarea
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              placeholder="e.g. Better navigation, new tools, UI changes..."
              rows={2}
              className="w-full bg-card border border-card-border rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500 resize-none placeholder:text-foreground-muted"
            />
          </div>

          {/* Bugs */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Any bugs or broken features?
            </label>
            <textarea
              value={bugs}
              onChange={(e) => setBugs(e.target.value)}
              placeholder="e.g. Button not working, page not loading..."
              rows={2}
              className="w-full bg-card border border-card-border rounded-lg px-4 py-3 text-sm outline-none focus:border-blue-500 resize-none placeholder:text-foreground-muted"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-error bg-error-muted px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg border border-card-border text-sm font-medium text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="material-symbols-rounded text-lg animate-spin">progress_activity</span>
                  Submitting...
                </>
              ) : (
                <>
                  <span className="material-symbols-rounded text-lg">send</span>
                  Submit Feedback
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
