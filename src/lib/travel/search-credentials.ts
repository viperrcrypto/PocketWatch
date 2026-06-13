/**
 * Shared loader for flight-search credentials + points balances.
 *
 * Extracted from the SSE search route so both the route and the PocketLLM chat
 * tool can resolve the user's Roame / SerpAPI / point.me credentials (with
 * auto-refresh) and card-derived balances without duplicating the flow.
 *
 * userId is always supplied by the caller from a server-resolved session — never
 * from request/tool input — and every DB query is scoped by it.
 */

import { db } from "@/lib/db"
import { decryptCredential, encryptCredential } from "@/lib/finance/crypto"
import { cardProfilesToBalances } from "@/lib/travel/balance-adapter"
import { isSessionExpired, refreshFirebaseToken, buildRoameSession } from "@/lib/travel/roame-auth"
import { isPointMeTokenExpired, refreshPointMeToken } from "@/lib/travel/pointme-auth"
import type { PointsBalance, RoameCredentials } from "@/types/travel"

const SEARCH_SERVICES = ["roame", "serpapi", "atf", "roame_refresh", "pointme", "pointme_refresh"]

export interface ResolvedSearchCredentials {
  roameSession?: RoameCredentials
  serpApiKey?: string
  pointmeToken?: string
}

async function upsertCredential(userId: string, service: string, encrypted: string): Promise<void> {
  await db.financeCredential.upsert({
    where: { userId_service: { userId, service } },
    create: { userId, service, encryptedKey: encrypted, encryptedSecret: encrypted, environment: "production" },
    update: { encryptedKey: encrypted, encryptedSecret: encrypted },
  })
}

/** Decrypt the stored Roame/SerpAPI/point.me rows for this user. */
async function decryptRows(userId: string) {
  const creds = await db.financeCredential.findMany({
    where: { userId, service: { in: SEARCH_SERVICES } },
  })

  let roameSession: RoameCredentials | undefined
  let serpApiKey: string | undefined
  let refreshToken: string | undefined
  let pointmeToken: string | undefined
  let pointmeRefreshToken: string | undefined

  for (const cred of creds) {
    if (cred.service === "pointme") {
      pointmeToken = await decryptCredential(cred.encryptedKey)
    } else if (cred.service === "pointme_refresh") {
      pointmeRefreshToken = await decryptCredential(cred.encryptedKey)
    } else if (cred.service === "roame") {
      const parsed = JSON.parse(await decryptCredential(cred.encryptedKey)) as RoameCredentials
      if (!isSessionExpired(parsed.session)) roameSession = parsed
    } else if (cred.service === "serpapi") {
      serpApiKey = await decryptCredential(cred.encryptedKey)
    } else if (cred.service === "roame_refresh") {
      refreshToken = await decryptCredential(cred.encryptedKey)
    }
  }

  return { roameSession, serpApiKey, refreshToken, pointmeToken, pointmeRefreshToken }
}

/** Auto-refresh the Roame session via Firebase when expired but a refresh token exists. */
async function refreshRoame(userId: string, refreshToken: string): Promise<RoameCredentials | undefined> {
  try {
    const result = await refreshFirebaseToken(refreshToken)
    const session = buildRoameSession(result.idToken)
    await Promise.all([
      upsertCredential(userId, "roame", await encryptCredential(JSON.stringify(session))),
      upsertCredential(userId, "roame_refresh", await encryptCredential(result.refreshToken)),
    ])
    return session
  } catch (err) {
    console.warn("[travel] Roame auto-refresh failed:", (err as Error).message)
    return undefined
  }
}

/** Auto-refresh the point.me token via Auth0 when expired but a refresh token exists. */
async function refreshPointMe(userId: string, pointmeRefreshToken: string): Promise<string | undefined> {
  try {
    const result = await refreshPointMeToken(pointmeRefreshToken)
    await Promise.all([
      upsertCredential(userId, "pointme", await encryptCredential(result.accessToken)),
      upsertCredential(userId, "pointme_refresh", await encryptCredential(result.refreshToken)),
    ])
    return result.accessToken
  } catch (err) {
    console.warn("[travel] point.me auto-refresh failed:", (err as Error).message)
    return undefined
  }
}

/** Resolve Roame / SerpAPI / point.me credentials for a user, refreshing expired tokens. */
export async function loadSearchCredentials(userId: string): Promise<ResolvedSearchCredentials> {
  const { roameSession, serpApiKey, refreshToken, pointmeToken, pointmeRefreshToken } = await decryptRows(userId)

  let resolvedRoame = roameSession
  if (!resolvedRoame && refreshToken) resolvedRoame = await refreshRoame(userId, refreshToken)

  let resolvedPointme = pointmeToken
  if (pointmeRefreshToken && (!pointmeToken || isPointMeTokenExpired(pointmeToken))) {
    resolvedPointme = await refreshPointMe(userId, pointmeRefreshToken)
  }

  return { roameSession: resolvedRoame, serpApiKey, pointmeToken: resolvedPointme }
}

/** Card-derived points balances for the search value engine. */
export async function loadPointsBalances(userId: string): Promise<PointsBalance[]> {
  const cards = await db.creditCardProfile.findMany({
    where: { userId },
    select: { id: true, cardName: true, rewardType: true, rewardProgram: true, pointsBalance: true, cashbackBalance: true },
  })
  return cardProfilesToBalances(cards)
}
