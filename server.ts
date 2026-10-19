// ComfyUI knowledge base behind x402 — PAID MCP tools demo.
// Bone-stock pattern from @x402/mcp README: createPaymentWrapper around each
// paid tool handler. Discovery (list_topics, ping) stays free; answers cost.
import express from "express";
import { readFileSync } from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createPaymentWrapper, x402ResourceServer } from "@x402/mcp";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const PORT = Number(process.env.PORT ?? 4021);
const PAY_TO = process.env.X402_PAY_TO;
const NETWORK = (process.env.X402_NETWORK ?? "eip155:84532") as `${string}:${string}`; // Base Sepolia; eip155:8453 = Base mainnet
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "https://x402.org/facilitator";
const PRICE = process.env.X402_PRICE ?? "$0.005";

if (!PAY_TO) throw new Error("X402_PAY_TO is required (your Base wallet address)");

// --- Load the snippet library (draft; owner-verified entries only go live) ---
const library = JSON.parse(readFileSync(new URL("./snippet-library.json", import.meta.url), "utf8"));

// Naive keyword match, on purpose: no cleverness in the demo.
function findSnippets(tool: any, query: string, limit = 2) {
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const scored = tool.snippets.map((s: any) => {
    const hay = `${s.id} ${s.problem} ${s.fix}`.toLowerCase();
    const score = tokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
    return { s, score };
  });
  scored.sort((a: any, b: any) => b.score - a.score);
  return scored.slice(0, limit).map(({ s }: any) => s);
}

// --- MCP server factory: one instance per SSE connection.
// (The README's singleton pattern crashes on the 2nd connection with
// "Already connected to a transport" — this keeps the same tool
// registrations, just scoped per connection.)
function createMcpServer() {
  const mcpServer = new McpServer({ name: "comfyui-knowledge", version: "0.1.0" });

  // --- Paid tools: one per snippet-library entry ---
  for (const tool of library.tools) {
    mcpServer.tool(
      tool.name,
      `${tool.description} Costs ${PRICE} per call, paid in USDC on Base via x402.`,
      { query: z.string().describe("Your error message, question, or topic.") },
      paid(async (args: { query: string }) => {
        const hits = findSnippets(tool, args.query);
        return { content: [{ type: "text" as const, text: JSON.stringify(hits, null, 2) }] };
      })
    );
  }

  // --- Free tools: discovery stays free, answers are paid ---
  mcpServer.tool("ping", "Health check. Free.", {}, async () => ({
    content: [{ type: "text" as const, text: "pong" }],
  }));

  mcpServer.tool("list_topics", "List available paid knowledge tools and snippet IDs. Free — call this first to see what's covered.", {}, async () => {
    const topics = library.tools.map((t: any) => ({
      tool: t.name,
      price_usdc: t.price_usdc,
      description: t.description,
      snippet_ids: t.snippets.map((s: any) => s.id),
    }));
    return { content: [{ type: "text" as const, text: JSON.stringify(topics, null, 2) }] };
  });

  return mcpServer;
}

// --- x402 ---
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitatorClient);
resourceServer.register(NETWORK, new ExactEvmScheme());
await resourceServer.initialize();

const accepts = await resourceServer.buildPaymentRequirements({
  scheme: "exact",
  network: NETWORK,
  payTo: PAY_TO,
  price: PRICE,
});
const paid = createPaymentWrapper(resourceServer, { accepts });

// --- StreamableHTTP transport (works through tunnels/proxies; SSE does not).
// One MCP server + transport per session, routed by Mcp-Session-Id.
const app = express();
app.use(express.json());
const transports: Record<string, StreamableHTTPServerTransport> = {};

async function getTransport(req: express.Request, res: express.Response) {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports[sessionId]) return transports[sessionId];
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sid) => {
      transports[sid] = transport;
    },
  });
  transport.onclose = () => {
    if (transport.sessionId) delete transports[transport.sessionId];
  };
  await createMcpServer().connect(transport);
  return transport;
}

app.post("/mcp", async (req, res) => {
  try {
    const transport = await getTransport(req, res);
    await transport.handleRequest(req, res, req.body);
  } catch (e: any) {
    console.error("POST /mcp error:", e?.message?.slice(0, 200));
    if (!res.headersSent) res.status(500).send("internal error");
  }
});
app.get("/mcp", async (req, res) => {
  const transport = transports[req.headers["mcp-session-id"] as string];
  if (!transport) return res.status(400).send("no session");
  await transport.handleRequest(req, res);
});
app.delete("/mcp", async (req, res) => {
  const transport = transports[req.headers["mcp-session-id"] as string];
  if (!transport) return res.status(400).send("no session");
  await transport.handleRequest(req, res);
});
app.get("/llms.txt", (_req, res) => res.type("text/plain").send(`# Quinn's Conveyance

> Agent payment infrastructure: APIs get paid per call in USDC via HTTP 402 + x402. No API keys, no accounts, no signup.

## What this is
Quinn's Conveyance implements x402 pay-per-call for API businesses. An AI agent calls an endpoint, receives a 402 Payment Required challenge with the price and wallet address, signs an EIP-3009 authorization (zero gas for the signer), and the facilitator settles USDC on-chain to the API owner's wallet. The API serves the response.

## Live reference implementation
- URL: https://demo.quinnsconveyance.com
- GET /health — free, returns status, network (eip155:8453 = Base mainnet), price ($0.005)
- POST /mcp — StreamableHTTP MCP endpoint. Tools ping and list_topics are free; 5 paid tools cost $0.005/call in USDC on Base.
- Unpaid calls to paid tools return the x402 payment challenge (pay $0.005 USDC to 0x3a97d5F616D26876020568bD631492F59cFB428C on Base).
- Proof of settlement: https://basescan.org/tx/0xb762d7856c03fc009b4743859850e075b997ea90d36a68681348e9634b0634f0

## Services
- Starter ($750): one endpoint behind 402, wallet setup, verified settlement. Live in under a week.
- Standard ($1,800): up to 5 endpoints, MCP wrapper, registry listings.
- Care plan ($150/mo): monitoring, facilitator updates, settlement reconciliation.

## Contact
- Email: john@quinnsconveyance.com
- GitHub: https://github.com/jkomalleyjr
`));

app.get("/health", (_req, res) => res.json({ status: "ok", network: NETWORK, price: PRICE }));

app.get("/", (_req, res) => res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quinn's Conveyance — Agent Payment Infrastructure</title>
<meta name="description" content="Agent payment infrastructure: put your API behind HTTP 402 so AI agents pay per call in USDC. x402 implementation services — one endpoint live in under a week.">
<meta property="og:title" content="Quinn's Conveyance — Agent Payment Infrastructure">
<meta property="og:description" content="Your API gets paid every time an AI agent calls it. HTTP 402 + x402, per-call USDC settlement, no API keys.">
<meta property="og:url" content="https://demo.quinnsconveyance.com">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://demo.quinnsconveyance.com">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"ProfessionalService","name":"Quinn's Conveyance","url":"https://demo.quinnsconveyance.com","description":"Agent payment infrastructure: x402 implementation services so APIs get paid per call in USDC.","email":"john@quinnsconveyance.com","priceRange":"$750-$1,800"}</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,'SF Pro Text',sans-serif;background:#08080d;color:#e8e8ee;min-height:100vh;overflow-x:hidden}
.orb{position:fixed;border-radius:50%;filter:blur(90px);opacity:.35;pointer-events:none;z-index:0}
.orb1{width:480px;height:480px;background:#b8860b;top:-140px;left:-120px}
.orb2{width:420px;height:420px;background:#1e3a5f;bottom:-120px;right:-100px}
.orb3{width:300px;height:300px;background:#4a2c6a;top:40%;left:60%;opacity:.22}
.wrap{position:relative;z-index:1;max-width:960px;margin:0 auto;padding:0 1.25rem}
nav{display:flex;justify-content:space-between;align-items:center;padding:1.5rem 0}
.brand{font-size:1.15rem;font-weight:700;letter-spacing:.02em}
.brand span{color:#d4a853}
nav .links a{color:#a0a0b0;text-decoration:none;margin-left:1.5rem;font-size:.92rem}
nav .links a:hover{color:#fff}
.hero{text-align:center;padding:4.5rem 0 3rem}
.hero h1{font-size:clamp(2rem,5.5vw,3.4rem);font-weight:800;line-height:1.15;letter-spacing:-.02em;background:linear-gradient(135deg,#fff 30%,#d4a853 70%,#f5d78e);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.hero p{margin:1.4rem auto 0;max-width:600px;color:#a0a0b0;font-size:1.1rem;line-height:1.7}
.cta{margin-top:2.2rem;display:flex;gap:1rem;justify-content:center;flex-wrap:wrap}
.btn{display:inline-block;padding:.85rem 1.9rem;border-radius:999px;text-decoration:none;font-weight:600;font-size:1rem;transition:transform .15s}
.btn:hover{transform:translateY(-2px)}
.btn-gold{background:linear-gradient(135deg,#d4a853,#b8860b);color:#0a0a0f}
.btn-glass{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
.glass{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.12);border-radius:22px;backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);box-shadow:0 8px 32px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.1)}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.2rem;margin:3rem 0}
.step{padding:1.8rem 1.6rem}
.step .n{display:inline-flex;align-items:center;justify-content:center;width:2.2rem;height:2.2rem;border-radius:50%;background:linear-gradient(135deg,#d4a853,#b8860b);color:#0a0a0f;font-weight:800;margin-bottom:1rem}
.step h3{font-size:1.05rem;margin-bottom:.6rem}
.step p{color:#a0a0b0;font-size:.93rem;line-height:1.65}
.step code{color:#f5d78e;background:rgba(212,168,83,.12);padding:.15em .45em;border-radius:6px;font-size:.85em}
section.block{margin:3.5rem 0}
section.block h2{font-size:1.5rem;margin-bottom:1.2rem;font-weight:700}
.demo{padding:2rem}
.demo table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.93rem}
.demo td,.demo th{padding:.7rem .5rem;text-align:left;border-bottom:1px solid rgba(255,255,255,.08)}
.demo th{color:#888896;font-weight:600;font-size:.82rem;text-transform:uppercase;letter-spacing:.06em}
.demo code{color:#f5d78e;background:rgba(212,168,83,.12);padding:.15em .45em;border-radius:6px;font-size:.85em;overflow-wrap:anywhere;word-break:break-all}
.demo a{color:#d4a853}
.free{color:#4ade80;font-weight:600}.paid{color:#d4a853;font-weight:600}
.demo p{color:#a0a0b0;line-height:1.7;margin:.8rem 0;font-size:.95rem}
.plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.2rem}
.plan{padding:2rem 1.8rem;text-align:center}
.plan h3{font-size:1.05rem;color:#d4a853;margin-bottom:.5rem}
.plan .price{font-size:2rem;font-weight:800;margin:.6rem 0}
.plan p{color:#a0a0b0;font-size:.9rem;line-height:1.65}
footer{text-align:center;padding:3rem 0 2.5rem;color:#888896;font-size:.92rem;border-top:1px solid rgba(255,255,255,.08);margin-top:4rem}
footer a{color:#d4a853;text-decoration:none}
@media(max-width:600px){nav .links{display:none}.hero{padding:3rem 0 2rem}}
</style></head>
<body>
<div class="orb orb1"></div><div class="orb orb2"></div><div class="orb orb3"></div>
<div class="wrap">
<nav><div class="brand">Quinn's <span>Conveyance</span></div><div class="links"><a href="#how">How it works</a><a href="#demo">Live demo</a><a href="#services">Services</a><a href="mailto:john@quinnsconveyance.com">Contact</a></div></nav>
<div class="hero">
<h1>Your API gets paid every time an AI agent calls it.</h1>
<p>Agent payment infrastructure built on <b>HTTP 402</b> and <b>x402</b>. AI agents pay per call in USDC — no accounts, no API keys, no checkout flow. You set the price; the chain settles it.</p>
<div class="cta"><a class="btn btn-gold" href="#demo">See the live demo</a><a class="btn btn-glass" href="mailto:john@quinnsconveyance.com">Get in touch</a></div>
</div>
<section class="block" id="how">
<div class="steps">
<div class="glass step"><div class="n">1</div><h3>Agent calls your API</h3><p>Instead of a key check, your endpoint answers <code>402 Payment Required</code> with the price, your wallet, and the chain.</p></div>
<div class="glass step"><div class="n">2</div><h3>Agent signs — pays zero gas</h3><p>The agent signs an EIP-3009 authorization. Signing is free; the agent needs no ETH, ever. This is the property the whole design rests on.</p></div>
<div class="glass step"><div class="n">3</div><h3>USDC settles to your wallet</h3><p>The facilitator verifies the signature and submits the transfer on-chain. Your API serves the response. Fractions of a cent in overhead.</p></div>
</div>
</section>
<section class="block" id="demo">
<h2>Live reference implementation</h2>
<div class="glass demo">
<table><tr><th>Endpoint</th><th>Cost</th></tr>
<tr><td><code>GET /health</code></td><td class="free">free</td></tr>
<tr><td><code>POST /mcp</code> — <code>ping</code>, <code>list_topics</code></td><td class="free">free</td></tr>
<tr><td><code>POST /mcp</code> — 5 paid tools</td><td class="paid">$0.005 / call</td></tr></table>
<p>Unpaid calls return the x402 payment challenge — pay $0.005 USDC to <code>${PAY_TO}</code> on Base. Real mainnet settlement, verifiable by anyone: <a href="https://basescan.org/tx/0xb762d7856c03fc009b4743859850e075b997ea90d36a68681348e9634b0634f0">view on Basescan</a>.</p>
</div>
</section>
<section class="block" id="services">
<h2>Implementation services</h2>
<div class="plans">
<div class="glass plan"><h3>Starter</h3><div class="price">$750</div><p>One endpoint behind 402. Wallet setup, verified settlement on Base. Live in under a week.</p></div>
<div class="glass plan"><h3>Standard</h3><div class="price">$1,800</div><p>Up to 5 endpoints, MCP wrapper, registry listings. The full agent-native surface.</p></div>
<div class="glass plan"><h3>Care plan</h3><div class="price">$150/mo</div><p>Monitoring, facilitator updates, settlement reconciliation. Ongoing.</p></div>
</div>
</section>
<footer>Quinn's Conveyance — moving value between agents and APIs.<br><a href="mailto:john@quinnsconveyance.com">john@quinnsconveyance.com</a> · <a href="https://github.com/jkomalleyjr">github.com/jkomalleyjr</a></footer>
</div></body></html>`));

app.listen(PORT, () => {
  console.log(`402 MCP demo on :${PORT} | network=${NETWORK} | price=${PRICE} | payTo=${PAY_TO}`);
});
