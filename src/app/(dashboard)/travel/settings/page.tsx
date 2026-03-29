import { redirect } from "next/navigation"

export default function TravelSettingsRedirect() {
  redirect("/settings?tab=travel")
}
