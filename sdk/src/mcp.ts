import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { z } from "zod";
import { createPaymentWrapper, x402ResourceServer } from "@x402/mcp";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import type {
  ChallengeEvent,
  Network,
  QuinnBaseConfig,
  SettlementEvent,
} from "./types.js";
import { priceToUsdc, runCallbacks } from "./types.js";
import { buildFacilitatorClient } from "./facilitator.js";

const DEFAULT_NETWORK = "eip155:8453" as Network;
const DEFAULT_PRICE = "$0.005";
const DEFAULT_SERVICE_NAME = "Quinn's Conveyance";

export interface PaidToolDef {
  name: string;
  description: string;
  /**
   * Zod shape for tool parameters. Default: { query: z.string() }.
   */
  parameters?: Record<string, z.ZodTypeAny>;
  /**
   * JSON schema for bazaar discovery. Defaults to a string-typed schema
   * built from `parameters` keys.
   */
  inputSchema?: Record<string, unknown>;
  /** Example input for bazaar discovery (e.g. { query: "my api returns 400" }). */
  example?: Record<string, unknown>;
  /** Return the tool result: a string, or anything JSON-serializable. */
  handler: (args: any) => Promise<string | unknown> | string | unknown;
}

export interface PaidMcpConfig extends QuinnBaseConfig {
  /** Server identity. Defaults to name "quinns-x402", version "0.1.0". */
  name?: string;
  version?: string;
  /**
   * Public HTTPS URL of the MCP endpoint, e.g.
   * "https://demo.quinnsconveyance.com/mcp". The bazaar catalog records this
   * as the callable endpoint, so it must be public HTTPS for indexing.
   */
  publicUrl: string;
  tools: PaidToolDef[];
}

export interface PaidMcpHandle {
  /** Create one McpServer per connection (the @x402/mcp README singleton crashes on 2nd connection). */
  createServer: () => McpServer;
  resourceServer: x402ResourceServer;
}

const defaultParameters = { query: z.string().describe("Your question or topic.") };

function zodShapeToJsonSchema(parameters: Record<string, z.ZodTypeAny>): Record<string, unknown> {
  return {
    type: "object",
    properties: Object.fromEntries(Object.keys(parameters).map((k) => [k, { type: "string" }])),
    required: Object.keys(parameters),
  };
}

/**
 * Build a paid MCP server factory. Mirrors the Quinn's Conveyance demo pattern:
 * per-tool createPaymentWrapper, bazaar discovery extension per tool so the
 * facilitator's catalog indexes every tool after a paid call, and settlement
 * hooks normalized into ChallengeEvent/SettlementEvent. Challenge events are
 * detected at the transport layer (the @x402/mcp server wrapper exposes no
 * working server-side challenge hook — see detectChallenges below).
 *
 * ```ts
 * import { createPaidMcpServer } from "quinns-x402";
 *
 * const mcp = await createPaidMcpServer({
 *   payTo: "0xYourWallet",
 *   publicUrl: "https://demo.yourco.com/mcp",
 *   tools: [
 *     { name: "get_answer", description: "Answers your question", example: { query: "hello" },
 *       handler: async (args) => "the answer" },
 *   ],
 *   onSettlement: async (e) => console.log("settled", e.txHash),
 * });
 * // one McpServer per connection:
 * const transport = new StreamableHTTPServerTransport(...);
 * await mcp.createServer().connect(transport);
 * ```
 */
export async function createPaidMcpServer(config: PaidMcpConfig): Promise<PaidMcpHandle> {
  const payTo = config.payTo;
  if (!payTo) throw new Error("[quinns-x402] payTo (your Base wallet) is required");
  const network = config.network ?? DEFAULT_NETWORK;
  const defaultPrice = config.price ?? DEFAULT_PRICE;
  const serviceName = config.serviceName ?? DEFAULT_SERVICE_NAME;

  const facilitatorClient = buildFacilitatorClient(config);
  const resourceServer = new x402ResourceServer(facilitatorClient);
  resourceServer.register(network, new ExactEvmScheme());
  await resourceServer.initialize();

  const accepts = await resourceServer.buildPaymentRequirements({
    scheme: "exact",
    network,
    payTo,
    price: defaultPrice,
  });

  // challenge → settlement latency correlation, keyed by tool name
  const challengeTs = new Map<string, number>();

  // --- Challenge detection (transport layer).
  // The x402 MCP wrapper answers unpaid paid-tool calls with a 402 challenge
  // (HTTP 200, MCP-level error carrying the x402 payload) — but it invokes
  // no server-side hook on that path, so this layer sees every challenge.
  // A tools/call to a paid tool WITHOUT the "x402/payment" params._meta
  // entry is a fresh challenge: stamp challengeTs (for latency) and fire
  // onChallenge callbacks. Paid retries carry _meta["x402/payment"] and are
  // not logged. Fire-and-forget and fail-open: detection never delays or
  // breaks the MCP response. This is the ONLY challenge writer — no
  // double-logging path exists.
  const paidToolNames = new Set(config.tools.map((t) => t.name));
  const X402_PAYMENT_META = "x402/payment";

  function recordChallenge(toolName: string, args: unknown, extra: any) {
    const event: ChallengeEvent = {
      surface: "mcp",
      resource: toolName,
      priceUsdc: Number(accepts[0]?.amount ?? "0") / 1e6,
      ip: "unknown",
      userAgent: headerValue(extra?.requestInfo?.headers, "user-agent") ?? "unknown",
      sessionId: typeof extra?.sessionId === "string" ? extra.sessionId : "unknown",
      args,
      at: new Date(),
    };
    challengeTs.set(toolName, Date.now());
    void runCallbacks(config.onChallenge, async (cb) => {
      await cb(event);
    });
  }

  function detectChallenges(message: any, extra: any) {
    try {
      if (!message) return;
      const msgs = Array.isArray(message) ? message : [message];
      for (const m of msgs) {
        if (!m || typeof m !== "object") continue;
        if (m.method !== "tools/call") continue;
        const name = m.params?.name;
        if (typeof name !== "string" || !paidToolNames.has(name)) continue;
        const meta = m.params?._meta;
        const paid = meta && typeof meta === "object" && meta[X402_PAYMENT_META] != null;
        if (paid) continue;
        recordChallenge(name, m.params?.arguments ?? {}, extra);
      }
    } catch (e) {
      console.error("[quinns-x402] challenge detection failed (fail-open):", (e as Error).message);
    }
  }

  // NOTE: no onPaymentRequired hook here. The @x402/mcp SERVER wrapper only
  // ever invokes onBeforeExecution / onAfterExecution / onAfterSettlement —
  // onPaymentRequired is a CLIENT-side hook (registered on the paying client
  // to receive challenges), so wiring it server-side accepts silently and
  // never runs (the wrapper returns the 402 result without touching hooks
  // when no payment is present). Challenges are therefore detected at the
  // transport layer in createServer() below — see detectChallenges().
  const baseHooks = {
    onAfterSettlement: async ({ settlement, toolName, arguments: args, paymentPayload, paymentRequirements }: any) => {
      try {
        const tx = settlement?.transaction ?? "unknown";
        const payer =
          (paymentPayload as any)?.payer ??
          (settlement as any)?.payer ??
          (paymentPayload as any)?.payload?.authorization?.from ??
          "unknown";
        const amountRaw = (paymentRequirements as any)?.amount ?? accepts[0]?.amount ?? "0";
        const priceRaw = accepts[0]?.amount ?? "0";
        const chTs = challengeTs.get(toolName);
        const latencyMs = chTs ? Date.now() - chTs : null;
        if (chTs) challengeTs.delete(toolName);
        const event: SettlementEvent = {
          surface: "mcp",
          resource: toolName,
          txHash: tx,
          payer,
          payee: payTo,
          amountUsdc: Number(amountRaw) / 1e6,
          priceUsdc: Number(priceRaw) / 1e6,
          latencyMs,
          ip: "unknown",
          userAgent: "unknown",
          sessionId: "unknown",
          args,
          at: new Date(),
          paymentPayload,
          paymentRequirements,
        };
        await runCallbacks(config.onSettlement, async (cb) => {
          await cb(event);
        });
        console.log(`[quinns-x402] ${toolName} settled ${tx} — $${event.amountUsdc} from ${payer}`);
      } catch (e) {
        console.error("[quinns-x402] settlement callback failed (fail-open):", (e as Error).message);
      }
    },
  };

  const perToolWrapper = (tool: PaidToolDef) => {
    // The wrapper derives its internal toolName from resource.url; unset it
    // defaults to the literal "paid_tool". The bazaar catalog also records
    // resource.url as the callable endpoint, so it must be the public HTTPS
    // MCP URL. Re-inject the real tool name in the hooks.
    const toolHooks = {
      onAfterSettlement: (ctx: any) => baseHooks.onAfterSettlement({ ...ctx, toolName: tool.name }),
    };
    const parameters = tool.parameters ?? defaultParameters;
    return createPaymentWrapper(resourceServer, {
      accepts,
      hooks: toolHooks,
      resource: {
        url: config.publicUrl,
        description: tool.description,
        serviceName,
        tags: config.tags,
      },
      extensions: declareDiscoveryExtension({
        toolName: tool.name,
        description: tool.description,
        transport: "streamable-http",
        inputSchema: tool.inputSchema ?? zodShapeToJsonSchema(parameters),
        example: tool.example,
      }),
    });
  };

  function headerValue(headers: any, name: string): string | undefined {
    try {
      if (!headers) return undefined;
      if (typeof headers.get === "function") {
        const v = headers.get(name);
        return v == null ? undefined : String(v);
      }
      const v = headers[name] ?? headers[name.toLowerCase()];
      return v == null ? undefined : String(Array.isArray(v) ? v[0] : v);
    } catch {
      return undefined;
    }
  }

  function createServer(): McpServer {
    const mcpServer = new McpServer({
      name: config.name ?? "quinns-x402",
      version: config.version ?? "0.1.0",
    });
    for (const tool of config.tools) {
      const paid = perToolWrapper(tool);
      const parameters = tool.parameters ?? defaultParameters;
      mcpServer.tool(
        tool.name,
        `${tool.description} Costs ${defaultPrice} per call, paid in USDC on Base via x402.`,
        parameters,
        paid(async (args: any) => {
          const result = await tool.handler(args);
          const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
          return { content: [{ type: "text" as const, text }] };
        }),
      );
    }
    // Wrap connect() so challenge detection rides the transport: after the
    // MCP Protocol installs its onmessage handler, chain ours in front of it.
    // Transports dispatch through the onmessage property at request time, so
    // every inbound JSON-RPC message is inspected before handling. This runs
    // for any transport (StreamableHTTP, stdio) without changing user code.
    const originalConnect = mcpServer.connect.bind(mcpServer);
    mcpServer.connect = async (transport: Transport) => {
      await originalConnect(transport);
      const protocolHandler = transport.onmessage;
      if (typeof protocolHandler === "function") {
        transport.onmessage = ((message: any, extra: any) => {
          detectChallenges(message, extra);
          return protocolHandler(message, extra);
        }) as typeof transport.onmessage;
      }
    };
    return mcpServer;
  }

  return { createServer, resourceServer };
}

// Re-export the pieces clients need for types only.
export type { McpServer };
