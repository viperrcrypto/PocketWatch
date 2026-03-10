import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("FID10", "Authentication required", 401)

  try {
    const identities = await db.financeAccountIdentity.findMany({
      where: { userId: user.id },
    })

    const accountIds = identities.map((i) => i.accountId)
    const accounts = await db.financeAccount.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, name: true, mask: true },
    })
    const accountMap = new Map(accounts.map((a) => [a.id, a]))

    const decrypted = await Promise.all(
      identities.map(async (identity) => ({
        accountId: identity.accountId,
        accountName: accountMap.get(identity.accountId)?.name ?? null,
        mask: accountMap.get(identity.accountId)?.mask ?? null,
        ownerNames: JSON.parse(await decryptCredential(identity.ownerNames)),
        emails: identity.emails ? JSON.parse(await decryptCredential(identity.emails)) : [],
        phoneNumbers: identity.phoneNumbers ? JSON.parse(await decryptCredential(identity.phoneNumbers)) : [],
        addresses: identity.addresses ? JSON.parse(await decryptCredential(identity.addresses)) : [],
      }))
    )

    return NextResponse.json({ accounts: decrypted })
  } catch (err) {
    return apiError("FID11", "Failed to fetch identity data", 500, err)
  }
}
