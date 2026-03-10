import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { LandingPage } from "@/components/landing-page"

export default async function RootPage() {
  let session = null
  try {
    session = await getSession()
  } catch {
    // DB unavailable — treat as not authenticated
  }

  if (session) {
    redirect("/portfolio")
  }

  return <LandingPage />
}
