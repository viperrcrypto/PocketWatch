import { redirect } from "next/navigation"

export default function PortfolioSettingsRedirect() {
  redirect("/settings?tab=digital-assets")
}
