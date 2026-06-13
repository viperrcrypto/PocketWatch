# PocketWatch Travel Providers

PocketWatch searches flight (and hotel) inventory across multiple providers in
parallel, then scores every result with the value engine (cents-per-point,
sweet-spot matching, funding paths). Providers fall into two groups:

- **Free / keyless** — always on, no setup, no account.
- **Paid / keyed** — **dormant until you paste a key** in Travel Settings. No key = the
  provider is simply skipped; nothing breaks.

All keys are stored encrypted (per-user AES, wrapped with a server master key).
They are never logged in plaintext and never returned to the browser — Settings
only ever shows a masked preview.

---

## Free providers (no setup, always on)

These run on every search automatically. Nothing to configure.

| Provider | Type | What it adds |
|----------|------|--------------|
| **Skiplagged** | Cash + hidden-city | Cash fares plus hidden-city ("skiplagging") itineraries the cash APIs can't see. Keyless MCP. |
| **Kiwi** | Cash | Cash fares including budget / low-cost carriers that SerpAPI/Google often miss. Keyless MCP. |
| **Trivago** | Hotels (cash) | Cash hotel rates aggregated across booking sites. Keyless. |

There is nothing to enable or pay for. If a free provider has an outage, the
search still completes with whatever other providers returned.

---

## Paid providers (dormant until a key is added)

Each of these is **off by default**. The orchestrator only calls a paid provider
when its credential exists for your user. To enable one: open **Travel → Settings**,
find the provider, paste the key/token, and save. To disable: delete the credential.

### SerpAPI (Google Flights + Google Hotels)

- **Cost:** SerpAPI paid plans (free tier ~100 searches/mo; paid plans from ~$75/mo).
- **Unlocks:** Google Flights cash itineraries (native round-trip support) and
  Google Hotels cash rates. This is the primary cash-fare source.
- **How to enable:**
  1. Sign up at <https://serpapi.com> and copy your **API Key** from the dashboard.
  2. Travel → Settings → **SerpAPI** → paste the key → Save.
- **Dormant until added:** with no SerpAPI key, Google Flights/Hotels are skipped.

### Roame

- **Cost:** Roame subscription (paid). PocketWatch uses your logged-in Roame
  **session**, not a classic API key.
- **Unlocks:** Award availability + Roame's own value scoring across many mileage
  programs, with the richest fare metadata (seats, equipment, durations, stops).
- **How to enable:**
  1. Log in to Roame in your browser and grab your session JWT (or the full
     session JSON containing a `session` field).
  2. Travel → Settings → **Roame** → paste the JWT or JSON → Save.
  - PocketWatch auto-refreshes the session via the stored refresh token when it
    expires, so you normally paste this only once.
- **Dormant until added:** no session = Roame is skipped.

### point.me

- **Cost:** point.me subscription (paid).
- **Unlocks:** Additional award-availability coverage and routing across mileage
  programs, complementary to Roame.
- **How to enable:**
  1. Log in to point.me and obtain your access token (raw JWT) or full session JSON.
  2. Travel → Settings → **point.me** → paste it → Save.
  - The refresh token (if present in the JSON) is stored automatically and used to
    refresh the access token via Auth0 when it expires.
- **Dormant until added:** no token = point.me is skipped.

### ATF — Award Travel Finder

- **Cost:** Award Travel Finder paid API plan (tiered monthly call limits).
- **Unlocks:** Direct award availability across 19+ airlines/programs (British
  Airways/Avios, Qatar, Cathay, Virgin Atlantic, United, American, Alaska, and more),
  with cross-verification against Roame results.
- **How to enable:**
  1. Get an ATF API key from <https://awardtravelfinder.com>.
  2. Travel → Settings → **ATF** → paste the key → Save.
- **Budget note:** one ATF search = one call **per airline**, so a single route can
  spend ~20+ calls. PocketWatch restricts ATF to the **primary** origin/destination/date
  combo on multi-airport / flex-date searches to protect your monthly quota.
- **⚠️ Deprecated — use ATF (OAuth 2.1) below.** The Award Travel Finder API has moved
  to **OAuth 2.1**. This legacy `X-API-Key` integration (against
  `awardtravelfinder.com/api/v1`) will **fail to authenticate** — existing keys no
  longer work. Connect via the OAuth flow described next instead.
- **Dormant until added:** no key = ATF is skipped.

### ATF (OAuth 2.1) — Award Travel Finder, current

- **Cost:** Award Travel Finder **Premium** plan. The OAuth scope `mcp:read` is only
  granted to Premium accounts, so a non-Premium login will connect but return nothing.
- **Unlocks:** Award availability across all ATF airlines/programs in a **single**
  `search_all_airlines` call (replacing the old ~22-call per-airline fan-out), scored
  and cross-verified against Roame like every other award source.
- **How it works:** ATF is now an OAuth 2.1 authorization-code + PKCE **public client**
  (RFC 7591 dynamic client registration, no client secret). PocketWatch stores the
  resulting access + refresh tokens encrypted (service `atf_oauth`) and auto-refreshes
  the access token when it expires — you only authorize **once**.
- **How to connect (one-time):**
  1. Travel → Settings → **Award Travel Finder (OAuth)** → click **Connect ATF (OAuth)**.
  2. You're sent to ATF's login (`awardtravelfinder.com`). Sign in.
  3. ATF shows an **Authorize** screen — approve PocketWatch's `mcp:read` access.
  4. You're redirected back and the card flips to **Connected**. Done — searches now
     include ATF automatically.
- **`ATF_OAUTH_REDIRECT_URI` (env):** the OAuth callback URL ATF redirects to after
  Authorize. **Default:** `http://localhost:3500/api/travel/atf/callback` (local dev).
  To authorize from a deployed/remote instance, set this to your tunnel/public domain's
  callback (e.g. `https://<your-tunnel>/api/travel/atf/callback`) **and** register that
  exact URL with ATF, otherwise the redirect is rejected.
- **Disconnect:** remove the `atf_oauth` credential (revokes locally; ATF also exposes a
  token revocation endpoint).
- **Dormant until connected:** no `atf_oauth` token = ATF is skipped.

### Seats.aero  *(new)*

- **Cost:** **Seats.aero Pro — $9.99/month.** Includes the **Partner API** with up to
  **1,000 API calls/day**. **Non-commercial use only** (personal trip planning — do
  not resell or build a commercial product on top of it).
- **Unlocks:** Award availability across many mileage programs (United, Aeroplan,
  American, Alaska, Delta, Virgin Atlantic, etc.) via the Seats.aero Partner API.
  Each available cabin becomes an award result with the mileage cost, the mileage
  **program** (the `source`, e.g. `united`), remaining seats, and a Seats.aero deep
  link. Taxes are reported as `0` (Seats.aero returns mileage, not cash taxes).
- **How to get the Partner API key:**
  1. Subscribe to **Seats.aero Pro** at <https://seats.aero> ($9.99/mo).
  2. Open your Seats.aero **account / API** page and find the **Partner API key**
     (Seats.aero calls this the Partner-Authorization key). Copy it.
  3. In PocketWatch: **Travel → Settings → Seats.aero** → paste the Partner API key
     → Save.
- **How it appears in results:** Seats.aero award results carry `source: "atf"` with
  a `seatsaero` tag (Seats.aero is award-availability like ATF; the tag preserves
  provenance without changing the result schema). They're scored by the same value
  engine as every other award result.
- **Dormant until added:** with no Partner API key stored, Seats.aero is **never
  called** — the provider stays completely dormant. Add the key to turn it on; delete
  it to turn it back off.

---

## Quick reference

| Provider | Free? | Cost | Type | Setting name | Dormant w/o key |
|----------|-------|------|------|--------------|-----------------|
| Skiplagged | ✅ | — | Cash + hidden-city | (always on) | n/a |
| Kiwi | ✅ | — | Cash | (always on) | n/a |
| Trivago | ✅ | — | Hotels | (always on) | n/a |
| SerpAPI | ❌ | from ~$75/mo | Cash flights + hotels | SerpAPI | yes |
| Roame | ❌ | subscription | Award + scoring | Roame | yes |
| point.me | ❌ | subscription | Award | point.me | yes |
| ~~ATF (X-API-Key)~~ | ❌ | — | Award | ATF (legacy) | deprecated — fails auth |
| ATF (OAuth 2.1) | ❌ | Premium plan | Award (all airlines, 1 call) | Award Travel Finder (OAuth) | yes |
| Seats.aero | ❌ | $9.99/mo (1000 calls/day, non-commercial) | Award | Seats.aero | yes |

> A search needs **at least one** working provider. With zero credentials configured,
> the free keyless providers (Skiplagged, Kiwi) still return cash inventory, but for
> award availability you'll want at least one of Roame / point.me / ATF / Seats.aero.
