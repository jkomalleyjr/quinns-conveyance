# Quinn's Conveyance — x402 Pay-Per-Call Reference Implementation

Live demo: https://demo.quinnsconveyance.com

This is the reference implementation behind [Quinn's Conveyance](https://demo.quinnsconveyance.com) — agent payment infrastructure that puts any API behind **HTTP 402** so AI agents pay per call in USDC. No API keys, no accounts, no signup.

## How it works

1. An AI agent calls a paid MCP tool.
2. The server answers with an **x402 payment challenge**: price ($0.005), wallet address, and chain (Base mainnet).
3. The agent signs an **EIP-3009 authorization** — signing costs zero gas; the agent never needs ETH.
4. A facilitator verifies the signature and settles the USDC transfer on-chain.
5. The server returns the answer.

Proof of real mainnet settlement: [Basescan](https://basescan.org/tx/0xb762d7856c03fc009b4743859850e075b997ea90d36a68681348e9634b0634f0)

## Run it

```bash
npm install
cp .env.example .env   # set X402_PAY_TO to your Base wallet address
npm start              # serves :4021 — GET /health (free), POST /mcp (StreamableHTTP)
```

## Structure

- `server.ts` — Express + StreamableHTTP MCP server. Free tools (`ping`, `list_topics`) and paid tools (one per snippet-library entry, $0.005/call via `@x402/mcp` payment wrapper). Serves the landing page at `/` and machine-readable docs at `/llms.txt`.
- `snippet-library.json` — the knowledge base. Each entry becomes a paid tool. Swap in your own content.
- `client-test.ts` / `client-remote.ts` — test clients (local and remote).
- `.env.example` — required environment variables.

## Key implementation notes

- **TypeScript, not Python**: the per-tool `createPaymentWrapper` pattern only exists in `@x402/mcp` (TypeScript). Python's x402 SDK has HTTP middleware only.
- **Validate args before the payment wrapper**: unpaid calls with invalid args must still return the 402 challenge, not a validation error.
- **Per-connection MCP server instances**: the `@modelcontextprotocol/sdk` singleton crashes on the second SSE/HTTP connection — create one server per connection.
- **Facilitators**: `https://x402.org/facilitator` is testnet-only. For Base mainnet, use a mainnet-capable facilitator (this demo uses PayAI's — no API key required).

## Services

Want this pattern on your API? Fixed-scope implementations:

- **Starter ($750)** — one endpoint behind 402, wallet setup, verified settlement. Live in under a week.
- **Standard ($1,800)** — up to 5 endpoints, MCP wrapper, registry listings.
- **Care plan ($150/mo)** — monitoring, facilitator updates, settlement reconciliation.

Contact: john@quinnsconveyance.com
