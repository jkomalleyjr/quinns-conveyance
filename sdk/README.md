# quinns-x402

Put your API behind **HTTP 402** in minutes. Agents pay per call in USDC on
Base — no API keys, no signup forms, no billing stack.

`quinns-x402` is the opinionated wrapper Quinn's Conveyance uses in
production, packaged for clients. It wraps the official `@x402` SDK with the
defaults that work:

- **Facilitator:** PayAI (`https://facilitator.payai.network`) — settles Base
  mainnet, free tier, no API key
- **Network:** Base mainnet (`eip155:8453`), native USDC, EIP-3009 `exact`
  (buyer signs, never pays gas)
- **Discovery:** the Bazaar extension is declared automatically, so the
  facilitator's catalog indexes your endpoints after their first paid call
- **Settlement logging + verification** hooks built in

## Install

```bash
npm install quinns-x402 express
# optional, for the Postgres settlement logger:
npm install pg
```

## Express: paywall an API route

```ts
import express from "express";
import { x402, createSettlementLogger } from "quinns-x402";

const logger = createSettlementLogger(process.env.DATABASE_URL!, {
  verify: true, // verify each settlement with Flow Executor (fail-open-but-loud)
});

const app = express();
app.use(express.json());

app.use(
  x402({
    payTo: "0xYourBaseWallet",          // settlement lands here
    price: "$0.005",                    // default price per call
    resourceBaseUrl: "https://api.yourco.com", // required for bazaar indexing
    serviceName: "YourCo",
    tags: ["weather", "data"],
    routes: {
      "GET /api/weather": {
        description: "Current weather for a city",
        inputSchema: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
        example: { input: { city: "london" }, output: { tempC: 12 } },
      },
      // per-route price override:
      "GET /api/forecast": { description: "7-day forecast", price: "$0.02" },
    },
    onChallenge: logger.onChallenge,
    onSettlement: logger.onSettlement,
  }),
);

app.get("/api/weather", (req, res) => res.json({ tempC: 12 }));
app.listen(3000);
```

An unpaid request gets a `402` with a `PAYMENT-REQUIRED` header (price, wallet,
network, bazaar metadata). A paid request runs your handler; the settlement
arrives in `onSettlement` with the tx hash.

## MCP: paid tools

```ts
import { createPaidMcpServer } from "quinns-x402";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const mcp = await createPaidMcpServer({
  payTo: "0xYourBaseWallet",
  publicUrl: "https://demo.yourco.com/mcp", // must be public HTTPS for indexing
  tools: [
    {
      name: "get_answer",
      description: "Answers your question",
      example: { query: "why is the sky blue?" },
      handler: async (args) => `Here's the answer to: ${args.query}`,
    },
  ],
  onSettlement: async (e) => console.log("settled", e.txHash, `$${e.amountUsdc}`),
});

// One server per connection (see note in createPaidMcpServer docs):
import { randomUUID } from "node:crypto";
const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID });
await mcp.createServer().connect(transport);
```

Tool parameters default to `{ query: z.string() }`; pass `parameters` (a zod
shape) and `inputSchema` (JSON schema) for custom shapes.

## Settlement ledger (optional, Postgres)

`createSettlementLogger(connectionString, { verify })` returns
`{ onChallenge, onSettlement, updateVerifyStatus, pool, close }` compatible
with both surfaces above. Create the tables first:

```bash
psql "$DATABASE_URL" -f node_modules/quinns-x402/schema.sql
```

Schema (same tables the Quinn's Conveyance demo runs): `challenges` logs every
402 served (the funnel); `payments` logs every settlement with payer, amount,
challenge→settlement latency, and verification state.

## Verification (fail-open-but-loud)

With `verify: true`, each settlement is checked against Flow Executor's
settlement verifier (4 checks: signature recovery, nonce consumption,
transfer-log match, validity window) and the row is stamped:

| verify_status | meaning |
| --- | --- |
| `verified` | all checks passed |
| `failed` | checks ran, something didn't match |
| `unverified_verifier_down` | verifier unreachable — settlement kept, gap is visible |
| `unverified_error` | verification couldn't run (e.g. missing payload) |

Verification never blocks a settlement. Or call it directly:

```ts
import { verifySettlement } from "quinns-x402";
const result = await verifySettlement(settlementEvent); // { status, verified, detail }
```

## Defaults (override anything)

| Option | Default |
| --- | --- |
| `network` | `eip155:8453` (Base mainnet) |
| `facilitatorUrl` | `https://facilitator.payai.network` |
| `price` | `$0.005` |
| `serviceName` | `"Quinn's Conveyance"` |
| `payTo` | **required** — your Base wallet |

## Test it with a real payment

This repo's `test/` folder is a runnable end-to-end check (Express surface):
an unpaid request returns 402 carrying the bazaar extension, then a paid
request from a USDC-funded wallet settles on Base mainnet.

```bash
npm install                      # dev deps included
npx tsx test/test-server.ts      # terminal 1
npx tsx test/pay-client.ts       # terminal 2 — needs demo/buyer-key.txt (funded buyer wallet)
```

Note: the facilitator rejects *loopback* resource URLs for catalog indexing
(`resource_host_loopback`) — set `resourceBaseUrl` / `publicUrl` to your real
public HTTPS origin in production and endpoints index after their first paid
call.

## Publishing (manual step)

This package is **not yet published to npm**. To publish (needs the owner's
npm account):

```bash
npm run build
npm publish --access public
```

---

Built by [Quinn's Conveyance](https://demo.quinnsconveyance.com) — x402
implementation as a service. Your customers' settlement data stays yours;
it is never sold.
