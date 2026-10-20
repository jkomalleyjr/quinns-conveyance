# Quinn's Conveyance

**Your API gets paid every time an AI agent calls it.**

Quinn's Conveyance puts APIs behind [HTTP 402](https://www.x402.org) (the x402 protocol) so agents pay per call in USDC on Base — no API keys to issue, no signup forms, no cards, no invoicing, no billing stack to build. The wallet is the identity; the payment is the authorization.

This repo is the working proof: the live demo's source, and the SDK we ship to clients.

## Live proof

- **Demo** — an MCP server with 5 paid tools at $0.005/call: [demo.quinnsconveyance.com](https://demo.quinnsconveyance.com)
- **Insights** — every challenge and settlement, public: [demo.quinnsconveyance.com/insights](https://demo.quinnsconveyance.com/insights)
- **Settlement proof** — a real mainnet payment, settled via Coinbase CDP: [Basescan](https://basescan.org/tx/0x94de5713bf6973e5415dace7e15bd8bc937cc05a764cd4ae41d5da75ab754b07)
- **Listings** — Coinbase Bazaar + Agentic.market (all 5 tools), MCP Registry (`io.github.jkomalleyjr/quinns-conveyance`), PayAI Bazaar

## The SDK — `quinns-x402`

The same code the demo runs, packaged. Paywall an Express API or an MCP server in minutes:

```bash
npm install quinns-x402
```

```ts
import { x402, createSettlementLogger } from "quinns-x402";

const logger = createSettlementLogger(process.env.DATABASE_URL!, { verify: true });

app.use(x402({
  payTo: "0xYourBaseWallet",               // settlements land here, directly
  price: "$0.005",
  resourceBaseUrl: "https://api.yourco.com",
  routes: { "GET /api/weather": { description: "Current weather for a city" } },
  onChallenge: logger.onChallenge,
  onSettlement: logger.onSettlement,
}));
```

What you get beyond the official `@x402` packages:

- **Dual facilitators** — Coinbase CDP (JWT auth) or PayAI, one config line
- **Discovery built in** — Bazaar extension declared automatically; your endpoints index after their first paid call
- **A settlement ledger** — every 402 challenge and settlement in Postgres: payer wallet, amount, latency, conversion funnel
- **Verification on every settlement** — Flow Executor's 4 checks (signature, nonce, transfer log, validity window) recorded as `verify_status`, fail-open-but-loud, with a delayed re-check that corrects propagation-race false failures

Full docs: [sdk/README.md](sdk/README.md) · npm: [quinns-x402](https://www.npmjs.com/package/quinns-x402)

## How the demo works

[`demo/server.ts`](demo/server.ts) — an Express + MCP (StreamableHTTP) server. Paid calls flow: **402 challenge → EIP-3009 signed authorization → facilitator settlement on Base → response**. Settlements are logged to Postgres, verified, and rendered on the public Insights dashboard. Payments settle **directly to the operator's wallet** — the service never holds funds.

## Services

| | |
| --- | --- |
| **Implementation** | **$500 flat** — one API behind 402, dual facilitators, MCP wrapper, registry/Bazaar listings, settlement logging. Waived with a 12-month Operate plan. |
| **Operate Core** | **$150/mo** — settlement logging & monitoring, facilitator failover, monthly agent-traffic report. |
| **Operate Insights** | **$350/mo** — Core plus the live analytics dashboard. |

**Pilot program (3 slots):** free implementation + 90 days of Operate Insights, in exchange for a logo, a quote, and a case study with real numbers. Terms: [sales/pilot-agreement.md](sales/pilot-agreement.md) · [sales/pilot-offer.md](sales/pilot-offer.md)

## Writing

- [I put an MCP server behind HTTP 402 — here's the exact setup](https://dev.to/johnnyko/i-put-an-mcp-server-behind-http-402-heres-the-exact-setup-2094)
- [How We'll Measure the Agent Economy](https://dev.to/johnnyko/how-well-measure-the-agent-economy-415k) — the four-layer ruler we run: challenge→settlement funnel, wallet persistence, latency shape, verify_status on every settlement.

## Principles

- **No custody, ever.** Settlements go straight to the API owner's wallet.
- **Customer data is never sold.** The settlement database exists to operate and improve the service — it is not a data product.
- **Measure commerce, not transaction counts.**

## Contact

john@quinnsconveyance.com · [quinnsconveyance.com](https://quinnsconveyance.com) · X: [@JkomalleyjrO](https://x.com/JkomalleyjrO)
