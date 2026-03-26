/**
 * WebAuthn/Passkey utilities for PocketWatch.
 *
 * Handles challenge generation and storage, RP configuration,
 * and wraps @simplewebauthn/server for registration and authentication.
 */

import type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
} from "@simplewebauthn/server"
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server"

// ---------------------------------------------------------------------------
// Challenge store (in-memory with TTL)
// ---------------------------------------------------------------------------

interface StoredChallenge {
  challenge: string
  expiresAt: number
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000 // 5 minutes
// In-memory store — requires single-process deployment (fine for PocketWatch's
// single-user vault model). Use Redis/DB if deploying to multi-instance.
const challengeStore = new Map<string, StoredChallenge>()

export function storeChallenge(userId: string, challenge: string): void {
  challengeStore.set(userId, {
    challenge,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  })
}

export function consumeChallenge(userId: string): string | null {
  const entry = challengeStore.get(userId)
  challengeStore.delete(userId)
  if (!entry || entry.expiresAt < Date.now()) return null
  return entry.challenge
}

// Lazy cleanup on every store operation
function cleanupChallenges(): void {
  const now = Date.now()
  for (const [key, entry] of challengeStore) {
    if (entry.expiresAt < now) challengeStore.delete(key)
  }
}

// ---------------------------------------------------------------------------
// RP (Relying Party) configuration
// ---------------------------------------------------------------------------

export interface RpConfig {
  rpId: string
  rpName: string
  origin: string
}

/**
 * Derive RP config from the incoming request.
 * Behind a reverse proxy (Cloudflare Tunnel), request.url shows the internal
 * http://localhost URL — we must use forwarded headers to get the real origin.
 */
export function getRpConfig(request: Request): RpConfig {
  const url = new URL(request.url)
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host
  const hostname = host.split(":")[0]
  return {
    rpId: hostname,
    rpName: "PocketWatch",
    origin: `${proto}://${host}`,
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export async function createRegistrationOptions(
  userId: string,
  userName: string,
  existingCredentialIds: string[],
  rp: RpConfig,
): Promise<ReturnType<typeof generateRegistrationOptions>> {
  cleanupChallenges()

  const options = await generateRegistrationOptions({
    rpName: rp.rpName,
    rpID: rp.rpId,
    userName,
    attestationType: "none",
    excludeCredentials: existingCredentialIds.map((id) => ({ id })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  } satisfies GenerateRegistrationOptionsOpts)

  storeChallenge(`register:${userId}`, options.challenge)
  return options
}

export async function verifyRegistration(
  userId: string,
  response: unknown,
  rp: RpConfig,
): Promise<Awaited<ReturnType<typeof verifyRegistrationResponse>>> {
  const expectedChallenge = consumeChallenge(`register:${userId}`)
  if (!expectedChallenge) {
    throw new Error("Challenge expired or not found")
  }

  return verifyRegistrationResponse({
    response: response as VerifyRegistrationResponseOpts["response"],
    expectedChallenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpId,
  })
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export async function createAuthenticationOptions(
  userId: string,
  credentialIds: string[],
  rp: RpConfig,
): Promise<ReturnType<typeof generateAuthenticationOptions>> {
  cleanupChallenges()

  const options = await generateAuthenticationOptions({
    rpID: rp.rpId,
    allowCredentials: credentialIds.map((id) => ({ id })),
    userVerification: "preferred",
  } satisfies GenerateAuthenticationOptionsOpts)

  storeChallenge(`auth:${userId}`, options.challenge)
  return options
}

export async function verifyAuthentication(
  userId: string,
  response: unknown,
  credentialId: string,
  credentialPublicKey: Uint8Array,
  credentialCounter: bigint,
  rp: RpConfig,
): Promise<Awaited<ReturnType<typeof verifyAuthenticationResponse>>> {
  const expectedChallenge = consumeChallenge(`auth:${userId}`)
  if (!expectedChallenge) {
    throw new Error("Challenge expired or not found")
  }

  return verifyAuthenticationResponse({
    response: response as VerifyAuthenticationResponseOpts["response"],
    expectedChallenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpId,
    credential: {
      id: credentialId,
      publicKey: new Uint8Array(credentialPublicKey),
      counter: Number(credentialCounter),
    },
  })
}
