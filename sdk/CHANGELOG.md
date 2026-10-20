# Changelog

## 0.1.2

- **Delayed verification re-check** — the instant Flow verification races
  chain propagation and can return false `failed` results (authorizationState
  / window FAILs seconds after a good settlement). When the settlement
  logger's first check returns `failed`, it now re-checks once after
  `verifyRecheckDelayMs` (new `createSettlementLogger` option, default
  30000, 0 disables) and replaces the row if the re-check reaches a
  verdict, stamping `verify_detail` with `recheck@<n>s:` provenance. A
  re-check that cannot reach a verdict never downgrades the original
  result. Proven live on the Quinn's Conveyance demo: an initial `failed`
  flipped to `verified` (4/4 PASS) on the +30s re-check.

## 0.1.1

- **CDP facilitator config support** — both surfaces (`x402()` and
  `createPaidMcpServer()`) accept `cdp: { keyId, keySecret }` to settle
  through the Coinbase CDP facilitator with per-request JWT auth (settled
  endpoints are indexed in the CDP Bazaar + Agentic.market). When `cdp` is
  set, `facilitatorUrl` is ignored.
- **Challenge logging fixed for MCP servers** — the @x402/mcp server wrapper
  never invokes a server-side `onPaymentRequired` hook (it is client-side
  only), so MCP `onChallenge` callbacks previously never fired and no
  challenge rows were written. Challenges are now detected at the transport
  layer: unpaid `tools/call` messages (no `x402/payment` meta) fire
  `onChallenge` and stamp the latency clock, paid retries are not logged.
  No API change — `onChallenge` keeps its name and signature. (The Express
  surface was unaffected: its hook is a genuine server-side path in
  @x402/core.)

## 0.1.0

- Initial release: Express middleware (`x402()`) and MCP server factory
  (`createPaidMcpServer()`) for HTTP 402 pay-per-call with USDC on Base,
  PayAI facilitator by default, automatic Bazaar discovery extensions,
  Postgres settlement logger (`createSettlementLogger()`), and fail-open
  settlement verification (`verifySettlement()`).
