# Partner & Directory Opportunities — Quinn's Conveyance

Researched Oct 19, 2026. Key structural finding up front: **in the x402 world there are
almost no "partner application forms."** The main directories are *discovery indexes*
that list you automatically when a payment settles through a facilitator carrying the
**bazaar discovery extension**. The demo currently settles through PayAI but does NOT
declare that extension — verified live: querying PayAI's index for the demo wallet
(`0x3a97d5F616D26876020568bD631492F59cFB428C`) returns `total: 0`. Fixing that one
thing is the highest-leverage directory move available.

---

## 1. Coinbase x402 ecosystem

### 1a. x402 Bazaar — CDP discovery index (THE directory)
- **What it is:** Coinbase CDP's machine-readable catalog of x402 services
  (~24,335 resources as of an Oct 2, 2026 survey). This is the index agents actually
  query. Agentic.market (below) reads from it.
- **Listing API:** `https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources`
- **Check if you're listed:** `https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant?payTo=<wallet>`
- **How to get listed:** There is NO submission form and NO listing endpoint
  (`POST /discovery/resources` returns 405/404). A route is cataloged when:
  1. Its 402 response carries a valid `extensions.bazaar` declaration (input/output
     JSON Schema, description, price), and
  2. A payment for it **settles through the CDP facilitator**, with the client
     echoing the bazaar data in the payment payload.
- **Requirements:** CDP facilitator account/API keys (the demo currently uses PayAI,
  so this means adding or switching facilitators); public HTTPS endpoint; spec-
  conformant bazaar metadata. Optional provider metadata on the 402 `resource`
  object: `serviceName` (≤32 chars), `tags` (≤5), `iconUrl`.
- **Spec/docs:** https://docs.x402.org/extensions/bazaar
- **Cost:** Free. Listing exists only per-facilitator — settling via PayAI does NOT
  put you in CDP's index.
- **Honest caveat:** A crawl of the CDP index (Oct 13) found 77% of listed resources
  had ≤2 payers in 30 days — listing ≠ demand. It's distribution plumbing, not sales.

### 1b. Agentic.market — Coinbase's consumer-facing catalog
- **What it is:** "App store for agents" operated by Coinbase (explicitly NOT an
  x402 Foundation product). ~2,980 services at last check; 7 categories (Inference,
  Data, Media, Search, Social, Infrastructure, Trading). Launch listings included
  CoinGecko and Bloomberg (Data), Alchemy and QuickNode (Infrastructure) — small
  providers share shelf space with big brands.
- **How to get listed:** No separate submission. Its search runs over the services
  indexed by the x402 Bazaar; a smaller subset is curated by Coinbase with richer
  descriptions. Path in = get into the CDP Bazaar (1a). Public read API:
  `GET https://api.agentic.market/v1/services` and `/v1/services/search?q=`
  (documented in agentic.market/llms.txt).
- **Contact for the curated tier:** Kevin Leffew, Developer Partnerships, Coinbase
  (named in Coinbase partner press, e.g. the Massive x402 launch, Sept 1, 2026).
  No public email found — reachable via Coinbase developer channels / the x402 Slack.

### 1c. x402.org ecosystem page (x402 Foundation, Linux Foundation)
- **What it is:** The official ecosystem registry at x402.org — mostly facilitators,
  infrastructure, and Foundation members (Visa, Stripe, AWS, Google, etc.).
- **How entries are added:** As data files in the open-source site repo — each
  partner is a `metadata.json` (name, category, logo, supported networks/schemes)
  under `typescript/site/app/ecosystem/partners-data/<name>/` in
  **github.com/x402-foundation/x402**. Route in = open a GitHub PR with a
  metadata.json for Quinn's Conveyance, or ask first in the x402 Slack
  (**slack.x402.org**) / GitHub discussions.
- **Realistic odds:** The page skews to protocol infrastructure, not one-person
  service shops. A PR is free and cheap to try, but expect editorial gatekeeping.
  Low-to-moderate likelihood; do it after 1a/2 are done.

### 1d. Coinbase Developer Platform (CDP) partner program — general
- No x402-specific "implementation partner" directory exists at Coinbase. The
  partnership surface is the Developer Partnerships team (Kevin Leffew) and the
  Bazaar/Agentic.market indexes above. There is no application URL to file.

---

## 2. Cloudflare Monetization Gateway

### 2a. Monetization Gateway itself — closed beta, no partner directory
- **Status:** Closed beta since **Sept 30, 2026**; US-based buyers and sellers only;
  wider availability targeted early 2027. Settlements in USDC on Base via Coinbase's
  facilitator. Named production users: Cloudflare AI Gateway, Ceramic.ai,
  Stocktwits, API2PDF.
- **How to apply:** Sellers **request access through the Cloudflare dashboard** —
  there is no public application URL or partner/listing directory for the Gateway.
- **Eligibility (per launch coverage):** US-based; Cloudflare account **60+ days
  old**; **credit card on file**; verified email; the zone must be **proxied through
  Cloudflare for 30+ days** and pass zone security checks.
- **Blocker for Quinn's Conveyance:** `demo.quinnsconveyance.com` is served by Caddy
  on GCP and is NOT proxied through Cloudflare. Enrolling as a Gateway seller would
  require moving the domain behind Cloudflare first. This is a *product* beta to
  join as a seller later — not a listing channel for the implementation service.
- **Discovery:** Cloudflare says only that it "plans to help sellers make their
  services discoverable to agents" — a roadmap item, not a shipped directory.

### 2b. Cloudflare Partner Program (general) — poor fit
- **Apply:** https://www.cloudflare.com/partners/ · Partner Portal:
  portal.cloudflarepartners.com · Contact: **partners@cloudflare.com**
- **What it is:** A channel program (resellers, MSPs, technology partners) oriented
  to SASE/Zero Trust/Enterprise resale and product integrations. There is also a
  Technology Partner Program (application via the Cloudflare website) for companies
  with product integrations.
- **Verdict:** No x402/Monetization Gateway implementation-partner track exists.
  A one-person x402 implementation service doesn't fit the reseller/MSP mold, and
  there's no evidence Gateway work flows through this program. Lowest priority.

---

## 3. PayAI facilitator network

### 3a. PayAI discovery index (Bazaar) — the actionable PayAI listing
- **Index:** `https://facilitator.payai.network/discovery/resources`
  (~12,402 resources, Oct 2, 2026 survey; newest entries appear within minutes).
- **Verified status today:** `GET /discovery/resources?payTo=0x3a97d5F616D26876020568bD631492F59cFB428C`
  → `{"items": [], "total": 0}`. **The demo is NOT listed** despite settling real
  payments through PayAI — because its 402 responses don't declare the bazaar
  extension, so nothing gets cataloged.
- **How to get listed (no form, no fee):**
  1. Add the bazaar discovery extension to the demo's payment config in `server.ts`
     (for MCP tools: toolName + inputSchema + description via the MCP bazaar
     helper in `@x402/mcp`), plus `serviceName`/`tags` metadata.
  2. Make one paid call per tool through the normal client flow (the client must
     echo the bazaar extension in the payment payload — the official SDK client
     does this).
  3. Re-query `/discovery/resources?payTo=<wallet>` to confirm each tool appears.
- **Docs:** https://docs.x402.org/extensions/bazaar ·
  PayAI x402 reference: https://docs.payai.network/x402/reference
- **Note:** PayAI's $PAYAI token utility reportedly includes "Bazaar visibility
  boosts" — paid promotion inside their ecosystem exists if ever wanted.

### 3b. PayAI Merchant Portal (relationship, not a directory)
- **What:** payai.network Merchant Portal — sign in with wallet or email; buy
  facilitator credits (free tier = 1,000 settlements/mo, then $0.001/settlement),
  manage API keys, view analytics.
- **Use to Quinn's:** Worth registering the demo wallet so the business is a known
  merchant before any partner conversation. Not a listing.

### 3c. PayAI website "Ecosystem & Partners" — no application route
- The partners section on payai.network lists protocol-level partners (Solana
  Foundation, ElizaOS, IPFS, libp2p). **No application form or
...[truncated 4425 chars]