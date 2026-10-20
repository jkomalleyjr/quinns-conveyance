# QUINN'S CONVEYANCE — STATEMENT OF WORK (TEMPLATE)

**SOW #:** ______  **Date:** ____________
**Provider:** Quinn's Conveyance (John O'Malley) — john@quinnsconveyance.com
**Client:** ____________________________
**Client payTo wallet (Base):** ____________________________

## Scope — x402 implementation for one API

Provider will gate the API listed below behind HTTP 402 (x402 protocol), so AI agents pay per call in USDC on Base mainnet, settled directly to Client's wallet.

**API in scope:** ____________________________ (base URL)
**Endpoints in scope:** up to 10 — ____________________________
**Per-call price(s):** ____________________________ (USDC)

### Deliverables

1. Payment middleware deployed on Client's API (Express middleware or MCP server, per the API's shape), with per-route pricing as configured above
2. Dual-facilitator settlement: Coinbase CDP (primary) and PayAI (failover), configured and tested end-to-end on mainnet
3. Discovery listings: Coinbase Bazaar extension on every paid route/tool; MCP Registry listing if an MCP server is delivered
4. Settlement logging installed: every payment challenge and settlement recorded (tool/route, payer wallet, amount, latency, verification status) in a database Client can inspect
5. One live test settlement on mainnet, with the transaction hash provided as acceptance evidence
6. Short operator note: how pricing is changed, how facilitators fail over, and where the logs live

### Acceptance

The work is accepted when a real agent client call to a paid endpoint/tool completes end-to-end: 402 challenge → signed payment → settlement on Base mainnet → paid response, with the settlement visible in the log. Provider supplies the transaction hash.

## Price and payment

- **Implementation: $500 flat.** Waived in full if Client signs a 12-month Operate plan at signing.
- Optional ongoing service: **Operate Core $150/month** (logging, monitoring, facilitator failover, monthly agent-traffic report) or **Operate Insights $350/month** (Core plus the live analytics dashboard). Month-to-month after any initial term; cancel by email.
- Implementation fee is due on acceptance (Net 0). Operate fees are billed monthly in advance.
- Facilitator third-party fees, if any, are pass-through at the facilitator's published rates (currently first 1,000 settlements/month free, then $0.001/settlement) and are not marked up.

## Timeline

- Kickoff on receipt of: API docs/access, payTo wallet, technical contact.
- Go-live target: **5 business days** from kickoff, assuming Client-side access is provided promptly.

## Client responsibilities

- API documentation, credentials/test access, and a technical contact during setup
- Hosting environment access if Provider deploys into Client's infrastructure (otherwise Provider delivers code + deployment instructions)
- Final decisions on per-call pricing

## Out of scope (quoted separately if needed)

- Additional APIs or more than 10 endpoints
- Custom dashboards beyond the standard Insights dashboard
- Changes to Client's API itself (new endpoints, auth redesign)
- Non-Base networks

## Terms

- **No custody.** Payments settle directly to Client's wallet. Provider never holds or can move Client funds.
- **Data.** Settlement data is used to operate the service and produce Client's reports. Provider never shares or sells Client's raw customer data.
- **Ownership.** Client owns its API, data, and brand. The integration code delivered under this SOW is Client's to keep and use. Provider retains its SDK (`quinns-x402`), tooling, and methods.
- **Changes.** Scope changes are agreed in writing (email is fine) before work proceeds.

## Signatures

**Quinn's Conveyance**
Name: John O'Malley
Signature: ____________________________  Date: ____________

**Client**
Name / Title: ____________________________
Signature: ____________________________  Date: ____________
