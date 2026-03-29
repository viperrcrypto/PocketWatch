import { redirect } from "next/navigation"

export default function FinanceSettingsRedirect() {
  redirect("/settings?tab=finance")
}
