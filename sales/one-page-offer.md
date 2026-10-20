# Agent Paywall for Your API
### Turn AI crawler traffic into per-call revenue.

**The problem.** AI agents and crawlers hit your API thousands of times a day. They pay nothing. Blocking them forfeits the future; serving them free bleeds margin.

**What I build.** Your endpoints behind HTTP 402 + the x402 protocol: an agent requests → gets a price → pays in USDC on Base → gets the data. Machine-to-machine. No accounts, no checkout pages, no API keys.

## Pricing

**Implementation — $500 flat** (waived with a 12-month Operate plan)
Your API behind x402. Dual facilitators (PayAI + Coinbase CDP), MCP server wrapper so agents can call you as tools, per-call pricing config, registry and bazaar listings, settlement logging installed. Live in under a week.

**Operate Core — $150/mo**
Settlement logging and monitoring, facilitator failover, uptime, monthly one-page agent-traffic report. The protocol moves fast; you stay current without thinking about it.

**Operate Insights — $350/mo**
Everything in Core, plus the live analytics dashboard: every payment, every 402 challenge, challenge-to-settlement conversion, payer wallets, settlement verification status. See exactly which agents pay you and for what.

## Proof
Live demo with real settlements: https://demo.quinnsconveyance.com — /health is free, POST /mcp is the paid MCP endpoint (StreamableHTTP, $0.005/call on Base mainnet). Hosted on a Google Cloud free-tier VM with a static IP.
Example settlement on BaseScan: https://basescan.org/tx/0xb762d7856c03fc009b4743859850e075b997ea90d36a68681348e9634b0634f0

## How we start
15-minute call → fixed-scope proposal → build → you verify the first paid call yourself before final payment.

**You hold your own keys.** I never touch your funds.

## FAQ
**Do I need crypto experience?** No. I set up the wallet with you on the call; you approve everything.
**What if agents don't pay?** Then nothing changes — unpaid requests get a 402 and no data leaves. You've lost nothing and your API is future-ready.
**What do you need from me?** API docs and access, a test endpoint, and 30 minutes for wallet setup.

[Your Name] — [email] — [X handle]
