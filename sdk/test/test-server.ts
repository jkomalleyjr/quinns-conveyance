// Test server: dummy Express API protected by quinns-x402's x402() middleware.
// Run: PAY_TO=0xYourWallet npx tsx test/test-server.ts
import express from "express";
import { x402, createSettlementLogger } from "../src/index.js";

const PORT = Number(process.env.PORT ?? 4031);
const PAY_TO =
  process.env.PAY_TO ?? "0x3a97d5F616D26876020568bD631492F59cFB428C";

const app = express();
app.use(express.json());
app.set("trust proxy", true);

// Logger with verify enabled; if TEST_DATABASE_URL is unset we point at an
// unreachable DB on purpose — writes fail-open (errors logged, payments unaffected).
const logger = createSettlementLogger(
  process.env.TEST_DATABASE_URL ?? "postgres://nobody:nope@127.0.0.1:1/none",
  { verify: true },
);

app.use(
  x402({
    payTo: PAY_TO,
    price: "$0.005",
    resourceBaseUrl: `http://localhost:${PORT}`,
    serviceName: "Quinn's Conveyance (SDK test)",
    tags: ["test", "sdk"],
    routes: {
      "GET /api/answer": {
        description: "The answer to everything (SDK test route)",
        inputSchema: {
          type: "object",
          properties: { q: { type: "string" } },
          required: ["q"],
        },
        example: { input: { q: "meaning of life" }, output: { answer: 42 } },
      },
    },
    onChallenge: (e) =>
      console.log(`[test] CHALLENGE ${e.resource} price=$${e.priceUsdc} ip=${e.ip}`),
    onSettlement: [logger.onSettlement, (e) =>
      console.log(`[test] SETTLEMENT ${e.resource} tx=${e.txHash} amount=$${e.amountUsdc} payer=${e.payer} latency=${e.latencyMs}ms`)],
  }),
);

app.get("/api/answer", (req, res) => {
  res.json({ answer: 42, question: req.query.q ?? null });
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => console.log(`[test] server on http://localhost:${PORT}`));
