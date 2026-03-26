/**
 * Top-level section tabs for bottom nav (mobile) and tablet rail.
 * Shared between bottom-nav-section-switcher.tsx and tablet-rail-sidebar.tsx.
 */
export interface SectionTab {
  readonly key: string
  readonly icon: string
  readonly label: string
  readonly root: string
}

export const SECTION_TABS: readonly SectionTab[] = [
  { key: "netWorth",  icon: "equalizer",   label: "Worth",    root: "/net-worth" },
  { key: "finance",   icon: "monitoring",  label: "Finance",  root: "/finance" },
  { key: "portfolio", icon: "pie_chart",   label: "Assets",   root: "/portfolio" },
  { key: "travel",    icon: "flight",      label: "Travel",   root: "/travel" },
  { key: "ai",        icon: "smart_toy",   label: "Chat",     root: "/chat" },
] as const

/** Determine active section from pathname — shared by bottom nav and tablet rail. */
export function getActiveSection(pathname: string): string {
  if (pathname.startsWith("/net-worth")) return "netWorth"
  if (pathname.startsWith("/finance")) return "finance"
  if (pathname.startsWith("/portfolio") || pathname.startsWith("/tracker")) return "portfolio"
  if (pathname.startsWith("/travel")) return "travel"
  if (pathname.startsWith("/chat")) return "ai"
  return "netWorth"
}
