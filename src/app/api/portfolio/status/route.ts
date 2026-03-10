import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9001", "Authentication required", 401)

  try {
    const [serviceKeys, walletCount] = await Promise.all([
      db.externalApiKey.findMany({
        where: { userId: user.id },
        select: { serviceName: true },
      }),
      db.trackedWallet.count({ where: { userId: user.id } }),
    ])

    const configuredServices = serviceKeys.map((k) => k.serviceName)
    const hasSharedKey = !!process.env.ZERION_API_KEY
    const hasZerionKey = configuredServices.includes("zerion") || hasSharedKey
    const hasEtherscanKey = configuredServices.includes("etherscan")
    const hasAlchemyKey = configuredServices.includes("alchemy") || !!process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
    const hasCoinGeckoKey = configuredServices.includes("coingecko")
    const isProvisioned = hasZerionKey && walletCount > 0

    return NextResponse.json({
      isProvisioned,
      hasZerionKey,
      hasSharedKey,
      hasEtherscanKey,
      hasAlchemyKey,
      hasCoinGeckoKey,
      walletCount,
      configuredServices,
    })
  } catch (error) {
    return apiError("E9002", "Failed to load portfolio status", 500, error)
  }
}
