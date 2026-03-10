"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Redirect — address book is managed on the main accounts page */
export default function LabelsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/portfolio/accounts")
  }, [router])
  return null
}
