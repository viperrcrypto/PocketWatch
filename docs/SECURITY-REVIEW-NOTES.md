# Security Review Notes — `improvement-program` branch

Running log of security-sensitive surfaces added this session, for adversarial
review (tonight's tool + Fable). Each item: what it is, the trust boundary, what
was already checked, and what a reviewer should hammer.

---

## 1. Internal cron workers (Bearer-secret, NOT session-auth)

New endpoints, each gated by an env secret via `Bearer` header (mirroring the
existing `snapshot-worker` pattern):

- `POST /api/internal/travel/price-check-worker` — secret `TRAVEL_PRICE_CHECK_SECRET`
- `POST /api/internal/finance-digest-worker` — secret `FINANCE_DIGEST_SECRET`

**Checked (Fable):** fail-closed when the secret is unset (returns 401 before any
work); outer try/catch returns a structured 500; no PII/amounts in responses
(counts only). Uses ONLY keyless providers / no per-user credential decryption in
the price-check worker.

**Hammer:** (a) the `auth === \`Bearer ${SECRET}\`` compare is **not timing-safe**
(consistent with existing workers, but worth hardening across all workers with
`crypto.timingSafeEqual`); (b) confirm these endpoints are never reachable through
the public Cloudflare tunnel without the secret; (c) the digest worker iterates
all users — fine for single-user, but verify no cross-user leakage if multi-user.

## 2. CSV transaction export — `GET /api/finance/transactions/export`

Returns the user's full financial history as a download.

**Checked (Fable):** user-scoped query (`where userId`), bounded (`take 10000`),
excludes duplicates/excluded; **CSV formula-injection neutralized** (leading
`= + - @ \t \r` on TEXT fields get a `'` prefix; numeric amount left intact);
`Cache-Control: private, no-store`; 401 guard.

**Hammer:** (a) confirm the formula-injection regex covers every externally-sourced
text column (name, merchantName, category, account name — all Plaid/SimpleFIN
controlled); (b) session-expiry mid-download returns a JSON error blob as a `.csv`
— cosmetic, but confirm no auth bypass; (c) 10k-row silent truncation (no data
leak, just incompleteness).

## 3. Saved-routes CRUD — `/api/travel/saved-routes`

**Checked (Fable):** every GET/POST/DELETE scoped to `userId` (no IDOR — a foreign
id yields deleteMany count 0); zod-validated; `userId` injected server-side, not
from the body.

**Hammer:** validation completeness (ISO date regex, max lengths) — confirm no
stored-XSS vector if these strings render unescaped anywhere downstream.

## 4. Free MCP travel clients (Kiwi / Skiplagged / Trivago)

Server-side `fetch` to public keyless MCP endpoints. **Trivago's response embeds a
`system_message` we deliberately ignore** (read only `structuredContent`) to avoid
prompt-injection if results ever reach PocketLLM.

**Hammer:** confirm no provider response field flows into an LLM context
un-sanitized (esp. if these results get summarized by PocketLLM); confirm SSRF is
not possible (endpoints are hardcoded constants — good).

## 5. Finance MCP server — `POST /api/mcp` (BUILT + Fable-audited)

Exposes the 12 **read-only** finance/flight tools over JSON-RPC, token-authed
(`POCKETWATCH_MCP_TOKEN`), for Claude Desktop over the Cloudflare tunnel.
Files: `src/app/api/mcp/route.ts`, `src/lib/chat/mcp-server.ts`.

**Verified by Fable:** auth fail-closed (gate is the first statement; unset token
→ 401, no work); timing-safe compare; read-only is **structural** (all 12 tools
use only find*/groupBy; dispatch gated by `TOOL_NAMES` from the 12 definitions; no
mutation reachable); no SSRF/SQL injection (Prisma parameterized, no outbound
fetch in the tool path); userId resolved server-side (never from the request);
errors are generic JSON-RPC codes, no stack traces; `force-dynamic`, POST-only.

**Fixed after audit:** (a) `decryptField` now degrades to `null` instead of
throwing when it can't decrypt (the MCP route has no per-user DEK — `get_net_worth`
no longer 500s); (b) `isAuthorized` rejects tokens shorter than 32 chars; (c)
`/api/mcp` added to CSRF `EXEMPT_PREFIXES` (cookie-jar clients would otherwise 403).

**STILL FOR REVIEW / follow-up (logged, not yet done):**
- **No rate limiting** on the 401 path — a single static token is the whole
  perimeter. Mitigations: set a 32+ char `POCKETWATCH_MCP_TOKEN` (`openssl rand
  -hex 32`), and put **Cloudflare Access / IP allowlist** in front. Consider
  wiring `src/lib/rate-limit.ts` into the 401 path.
- `get_subscriptions` returns the encrypted `nickname` field as **ciphertext** via
  MCP when per-user encryption is active (user's own gibberish, not a cross-user
  leak — but ugly). Fix later: drop `nickname` from the select or fall back to
  `merchantName`.
- `tools/call` args are `as`-cast, not validated against each tool's input_schema
  (type confusion → opaque -32603, not a security hole; Prisma rejects bad types).
- Secret-sweep before any public push (token is env-only, must not be committed).

## 7. ATF OAuth 2.1 (BUILT + Fable-audited + FINISH-PASS DONE — now wired)

> UPDATE: the §7 finish-list below has been IMPLEMENTED. ATF OAuth is now wired
> into the search orchestrator (`atfUserId`) and functional pending one live
> Authorize click. Fixes applied this pass:
> 1. ✅ sameSite blocker → new `PkceFlow` table (+ migration) binds the flow to the
>    user server-side by `state`; connect writes it, callback consumes it
>    (delete-on-read = single-use) and uses `flow.userId` — no session-cookie
>    dependency. `?error=` is now sanitized before reflection.
> 2. ✅ storage split-brain → callback persists via the shared `persistAtfTokens`
>    (one writer, one shape).
> 3. ✅ concurrent-refresh → single-flight `Map<userId, Promise>` in the client.
> 4. ✅ credentials route → `atf_oauth` added to GET filter (Connected badge) +
>    DELETE enum (cascades to `atf_oauth_client`).
> 5. ✅ MCP transport → `Accept: application/json, text/event-stream`; SSE fallback
>    now parses the LAST `data:` frame.
> 6. ✅ wired into `searchOneLeg` (primary-combo gated); removed the paid-credential
>    guard since the free providers always run.
>
> STILL TO VALIDATE (needs the user's Premium token / live click): the actual
> `search_all_airlines` request args + response shape (mapper built defensively to
> the legacy ATF shape — re-verify against a real response); restore airline-specific
> booking deep links; require HTTPS `ATF_OAUTH_REDIRECT_URI` in production.

### Original finish-list (now done — kept for the reviewer's reference):

Files: `src/lib/travel/atf-oauth.ts` (PKCE + dynamic registration + token
exchange/refresh), `src/app/api/travel/atf/{connect,callback}/route.ts`,
`src/lib/travel/atf-mcp-client.ts` (Bearer MCP client + `search_all_airlines`),
plus a Connect-ATF card in `travel-settings-form.tsx`. **Not wired into the
orchestrator** (the old X-API-Key `searchATF` still runs).

**Fable verified GOOD:** PKCE (S256, 32-byte verifier, base64url), state/CSRF
(256-bit, exact-match, hard 400 on mismatch, `?error=` rejected first), tokens
encrypted at rest (AES-GCM via `encryptCredential`), no token/verifier/code in
URLs or logs, origin-bound post-redirect (no open redirect), connect route
session-guarded. ATF OAuth metadata re-probed live 2026-06-10 and confirmed.

**MUST FIX before it works (do these next, in order):**
1. **BLOCKER — sameSite=strict breaks the callback.** The PocketWatch session
   cookie is `sameSite: "strict"` (`src/lib/auth.ts`), so it is NOT sent on ATF's
   cross-site redirect back → `getCurrentUser()` is null in the callback → 401
   every real flow. **Fix:** bind the flow server-side — add a `PkceFlow` table
   (state PK, userId, codeVerifier, expiresAt; needs a migration), write it in
   `/connect`, look it up by `state` in the callback (delete-on-read = single-use),
   and use its `userId` instead of the session cookie. This also closes the
   "no server-side user binding" + "state not truly single-use" notes.
2. **BLOCKER — storage split-brain.** `atf/callback` writes `encryptedKey`=JSON
   `{access,refresh,expiresAt}` + `environment="production"`, but
   `atf-mcp-client.loadAtfTokens` reads `encryptedKey`=raw token +
   `environment`=epoch-ms. **Fix:** make the callback call the exported
   `persistAtfTokens` (one writer, one shape); drop `toStoredTokens`/`ATFStoredTokens`.
   (The compile error between the two modules is already fixed; this is the
   remaining *runtime* contract mismatch.)
3. **MAJOR — concurrent-refresh race.** Parallel legs refresh the same token →
   OAuth rotation reuse-detection can revoke the grant. Single-flight the refresh
   per userId (module-level `Map<string, Promise<string|null>>`).
4. **MAJOR — credentials route + disconnect.** Add `"atf_oauth"` to the GET
   `findMany` filter in `credentials/route.ts` (else the Connected badge never
   shows) and to the DELETE enum + a Remove button (no disconnect path today).
5. **MINOR — MCP transport unverified.** Send `Accept: application/json,
   text/event-stream`; parse the LAST `data:` SSE frame, not the first; verify
   `search_all_airlines` arg/response shape against a real Premium token before
   flipping the orchestrator. Restore airline-specific booking deep links.
6. Then wire `searchAtfAwards(userId, …)` into `searchOneLeg` (thread `userId`),
   and require HTTPS `ATF_OAUTH_REDIRECT_URI` in production.

## 6. Seats.aero client (DRAFT, unwired) + pre-existing cache note

- `src/lib/travel/seats-aero-client.ts` is a PAID gated provider, **not wired in**
  and **not live-tested** (needs a Pro key). Schema corrected per the official
  docs after Fable flagged the first draft as dead-on-arrival. Validate before wiring.
- **Pre-existing (flagged by Fable, not introduced this session):** the travel
  `responseCache` in `search-orchestrator.ts` / `hotel-orchestrator.ts` is keyed by
  route/date/class **without userId** — on a multi-user instance, credential-backed
  flight results could be served across users. Single-user today, but worth fixing
  if multi-user is ever enabled.
