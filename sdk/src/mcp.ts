import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
 * hooks normalized into ChallengeEvent/SettlementEvent.
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

  const baseHooks = {
    onPaymentRequired: async ({ toolName, arguments: args, paymentRequired }: any) => {
      try {
        const priceRaw =
          paymentRequired?.accepts?.[0]?.amount ?? accepts[0]?.amount ?? "0";
        const event: ChallengeEvent = {
          surface: "mcp",
          resource: toolName,
          priceUsdc: Number(priceRaw) / 1e6,
          ip: "unknown",
          userAgent: "unknown",
          sessionId: "unknown",
          args,
          at: new Date(),
        };
        challengeTs.set(toolName, Date.now());
        await runCallbacks(config.onChallenge, async (cb) => {
          await cb(event);
        });
      } catch (e) {
        console.error("[quinns-x402] challenge callback failed (fail-open):", (e as Error).message);
      }
    },
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
      onPaymentRequired: (ctx: any) => baseHooks.onPaymentRequired({ ...ctx, toolName: tool.name }),
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
    return mcpServer;
  }

  return { createServer, resourceServer };
}

// Re-export the pieces clients need for types only.
export type { McpServer };
