# QUINN'S CONVEYANCE — PILOT AGREEMENT

**Parties.** This Pilot Agreement ("Agreement") is between **Quinn's Conveyance** (John O'Malley, "Provider") and the company identified in the signature block below ("Client"). Contact: john@quinnsconveyance.com.

**Purpose.** Provider will put one of Client's APIs behind HTTP 402 (x402) so AI agents can pay per call in USDC, and operate it for a 90-day pilot period, in exchange for the case-study rights in Section 4.

## 1. What Provider delivers (no charge during the pilot)

- x402 payment gating on **one API** (one base URL, up to 10 endpoints; additional endpoints by agreement)
- Settlement through **two facilitators** — PayAI and Coinbase CDP — with automatic failover
- An **MCP server wrapper** for the API, where technically applicable
- Listings in the applicable discovery directories (Coinbase Bazaar, MCP Registry) using the API's tool descriptions
- **Settlement logging and the Operate Insights dashboard**: every payment challenge and settlement recorded (tool, arguments, payer wallet, amount, latency, verification status)
- **90 days of Operate Insights service** (monitoring, facilitator failover, monthly agent-traffic report) starting on the go-live date

Target go-live: **5 business days** from receipt of the items in Section 3.

## 2. Money and custody

- During the pilot, Provider charges Client **nothing**: no implementation fee, no Operate fee.
- Payments from agents settle **directly to Client's wallet** (the payTo address Client provides). **Provider never takes custody of Client's funds** and cannot move them.
- Facilitator network fees, if any, are the standard third-party terms of the facilitator used (currently: first 1,000 settlements/month free on both configured facilitators, then $0.001 per settlement, charged by the facilitator — not by Provider).

## 3. What Client provides

- API documentation and any credentials or test access needed to integrate
- One Base-network wallet address to receive payments (payTo)
- A technical contact who can answer integration questions during setup

## 4. What Client grants in exchange

- **Logo use**: Provider may display Client's name and logo on quinnsconveyance.com and in a list of pilot participants.
- **One named quote** from a Client representative about the pilot experience, approved by Client before use.
- **Case study**: after 30 days of live traffic, Provider may publish a case study using aggregate metrics from Client's deployment: challenge volume, challenge-to-settlement conversion, settlement count and total value, repeat-payer share, and settlement latency. **Client reviews and approves the final case-study text before publication.** Provider will not publish Client-identifying metrics Client has not approved.
- **Data line (absolute)**: Provider never shares or sells Client's raw customer data. Case-study metrics are aggregate only, published only with the approval above.

## 5. Data and privacy

- Settlement and challenge data is collected solely to operate the service, provide Client's dashboard and reports, and improve Provider's service.
- Client may request an export or deletion of its deployment data at any time by email.

## 6. After the pilot

- At day 90 the pilot converts to standard pricing **only if Client agrees in writing (email is fine)** — otherwise the paid operation simply ends; there is no automatic charge, ever.
- Standard pricing: implementation **$500 flat** (waived with a 12-month Operate plan); **Operate Core $150/month**; **Operate Insights $350/month**.
- Client may keep using the integration code delivered during the pilot regardless of whether it continues with Operate.

## 7. Term and termination

- Pilot term: 90 days from go-live.
- Either side may end this Agreement at any time by email. On termination, Provider will disable the Operate services for Client's deployment within 2 business days and, on request, delete or export Client's data.

## 8. General

- The pilot service is provided "as is"; Provider will make reasonable efforts to keep it available and will notify Client of known outages, but uptime is not guaranteed during the pilot.
- Either party's liability under this Agreement is limited to $1,000. Neither party is liable for indirect or consequential damages.
- Client retains all rights in its API, data, and brand. Provider retains all rights in its tooling, the `quinns-x402` SDK, and its methods.
- This Agreement is governed by the laws of the State of Washington. Email notices to the addresses in the signature blocks are effective on receipt.
- This document is the whole agreement for the pilot. Changes require both sides' written (email) agreement.

## Signatures

**Quinn's Conveyance**
Name: John O'Malley
Signature: ____________________________  Date: ____________

**Client**
Company: ____________________________
Name / Title: ____________________________
Signature: ____________________________  Date: ____________
PayTo wallet (Base): ____________________________
Technical contact (name / email): ____________________________
