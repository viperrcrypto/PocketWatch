/**
 * Skip to Content Link
 *
 * Accessibility feature that allows keyboard users to skip navigation
 * and jump directly to the main content.
 *
 * Should be the first focusable element on the page.
 */

"use client"

export function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="skip-to-content"
      style={{
        position: "absolute",
        left: "-9999px",
        zIndex: 9999,
        padding: "1rem 1.5rem",
        background: "var(--primary)",
        color: "var(--background)",
        textDecoration: "none",
        fontWeight: 600,
        fontSize: "0.875rem",
      }}
      onFocus={(e) => {
        // Move to viewport when focused
        e.currentTarget.style.left = "1rem"
        e.currentTarget.style.top = "1rem"
      }}
      onBlur={(e) => {
        // Move off-screen when blurred
        e.currentTarget.style.left = "-9999px"
        e.currentTarget.style.top = "auto"
      }}
    >
      Skip to main content
    </a>
  )
}
