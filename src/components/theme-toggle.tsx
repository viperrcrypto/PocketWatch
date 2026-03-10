"use client"

import { useEffect, useState } from "react"

type Theme = "light" | "dark"

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light"
  const stored = localStorage.getItem("theme") as Theme | null
  if (stored === "light" || stored === "dark") return stored
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTheme(getInitialTheme())
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.setAttribute("data-theme", theme)
    document.documentElement.style.background = theme === "dark" ? "#000" : "#fff"
    localStorage.setItem("theme", theme)
  }, [theme, mounted])

  const toggle = () => setTheme((t) => (t === "light" ? "dark" : "light"))

  // Avoid hydration mismatch — render placeholder until mounted
  if (!mounted) {
    return (
      <button
        className="flex items-center justify-center w-9 h-9 rounded-lg text-foreground-muted"
        aria-label="Toggle theme"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 20 }}>contrast</span>
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center w-9 h-9 rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 20 }}>
        {theme === "light" ? "dark_mode" : "light_mode"}
      </span>
    </button>
  )
}
