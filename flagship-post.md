# I put an MCP server behind HTTP 402. Here's the exact setup.

AI agents are hitting APIs thousands of times a day and paying nothing. I wanted to know if the "pay per call" story is real or slideware, so I built the smallest possible version: my own knowledge base, sold per query, settled on-chain. It works. Here's everything, including the transaction.

## What it is

Five MCP tools wrapping things I actually know — ComfyUI API-prompt fixes, node wiring recipes, verified dead ends (the kind of knowledge that only exists because I burned GPU hours finding out). Each tool costs $0.005 per call, paid in USDC on Base. Two more tools are free: `ping`, and `list_topics` so an agent can see what's for sale before spending anything. Discovery free, answers paid.

## The stack (all stock, nothing custom)

- `@x402/mcp` — Coinbase's x402 MCP package. The key primitive is `createPaymentWrapper`: you wrap each paid tool's handler and it handles the 402 challenge/response at the MCP protocol level. Paid tools and free tools live side by side.
- `@modelcontextprotocol/sdk` — the standard MCP server, StreamableHTTP transport via Express (plain SSE stalls behind tunnels — learned the hard way).
- Facilitator: PayAI's public facilitator for Base mainnet (no key needed on the free tier). Note: the x402.org facilitator is testnet-only despite what the docs imply — it errors on mainnet routes.
- Chain: Base. Testnet (Sepolia) for iteration, mainnet for the proof below.

The whole server is ~120 lines. The payment wrapper is the product; everything else is plumbing.

## The payment flow, measured

1. Agent calls a paid tool → server answers `402` with payment requirements ($0.005 USDC, my address, Base).
2. Agent signs an EIP-3009 authorization. **The buyer pays zero gas** — signing is free, no ETH needed. This is the property the whole design rests on.
3. Facilitator verifies the signature and submits the USDC transfer on-chain, paying the gas itself (~$0.001–0.05 on Base).
4. Server gets the settlement confirmation and returns the answer.

Measured end to end on testnet: https://sepolia.basescan.org/tx/0x5b0b2205606f13d7197a5c8d7556d413723d1ae84c9732eac1b3a4b1850fa2cb (success — $0.005 USDC moved). Then one real mainnet settlement: https://basescan.org/tx/0xb762d7856c03fc009b4743859850e075b997ea90d36a68681348e9634b0634f0 — $0.005 moved on Base, verifiable by anyone.

## The gas math nobody puts in the pitch deck

At $0.005 per call, gas is not a footnote — it's the margin. If the facilitator pays $0.002 to settle your half-cent payment, 40% of revenue is gone before you start. Per-call micro-pricing only survives with batching or a facilitator that sponsors gas. Price accordingly, and read the facilitator's terms before you set prices. (This is also why "millions of micro-settlements with zero friction" is a fantasy unless someone is batching underneath you.)

## What it costs to run

- Server: a Google Cloud e2-micro free-tier VM (static IP, systemd service). CPU-only — no GPU involved.
- Per sale: the facilitator's gas, ~fractions of a cent.
- My time to build it: an afternoon, most of it reading the x402 repo's own examples.

## What I actually think

The rail is real and the code is boring in the best way — that's the compliment. What's not real yet is the demand: nobody's agents are lining up to pay half a cent for answers. The people who will pay real money are businesses whose APIs are being scraped for free *right now*. That's who I'm building this for next.

If that's you — one endpoint behind 402, live in under a week, flat fee. Try the demo: https://demo.quinnsconveyance.com (`/health` is free, `POST /mcp` is the paid endpoint). Reach me at jkomalleyjr@gmail.com — more of my work at github.com/jkomalleyjr.
