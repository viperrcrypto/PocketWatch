import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { LandingPage } from "@/components/landing-page"
import { Suspense } from "react"

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>
}) {
  let session = null
  try {
    session = await getSession()
  } catch {
    // DB unavailable — treat as not authenticated
  }

  if (session) {
    const params = await searchParams
    redirect(params.redirect || "/portfolio")
  }

  return (
    <Suspense>
      <LandingPage />
    </Suspense>
  )
}
