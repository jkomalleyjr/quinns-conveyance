import type { RequestHandler } from "express";
import {
  x402ResourceServer,
  x402HTTPResourceServer,
  type RoutesConfig,
  type PaymentRequiredContext,
} from "@x402/core/server";
import { paymentMiddlewareFromHTTPServer, type PaywallConfig } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension, bazaarResourceServerExtension } from "@x402/extensions/bazaar";
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

export interface PaidRouteDef {
  /** Human description of the endpoint (shown in bazaar + 402). */
  description?: string;
  /** Override the default price for this route. */
  price?: string;
  /** JSON schema of query params (GET) or body (POST) — used for bazaar discovery. */
  inputSchema?: Record<string, unknown>;
  /** Example input / output for bazaar discovery. */
  example?: { input?: unknown; output?: unknown };
  /** Override service-level tags for this route. */
  tags?: string[];
  /** Response mime type. Default "application/json". */
  mimeType?: string;
}

export interface X402ExpressConfig extends QuinnBaseConfig {
  /** "GET /api/weather" → definition. All listed routes are paywalled. */
  routes: Record<string, PaidRouteDef>;
  /**
   * Public base URL, e.g. "https://api.client.com". The bazaar catalog records
   * resource = baseUrl + path as the callable endpoint, so this is required
   * for discovery indexing (mirrors the demo's PUBLIC_MCP_URL lesson).
   */
  resourceBaseUrl?: string;
  /** Optional custom paywall UI config. */
  paywallConfig?: PaywallConfig;
}

/**
 * Protect Express routes behind HTTP 402.
 *
 * ```ts
 * import express from "express";
 * import { x402 } from "quinns-x402";
 *
 * const app = express();
 * app.use(express.json());
 * app.use(x402({
 *   payTo: "0xYourWallet",
 *   price: "$0.005",
 *   resourceBaseUrl: "https://api.yourco.com",
 *   routes: {
 *     "GET /api/weather": {
 *       description: "Current weather for a city",
 *       inputSchema: { properties: { city: { type: "string" } }, required: ["city"] },
 *       example: { input: { city: "london" }, output: { tempC: 12 } },
 *     },
 *   },
 *   onSettlement: async (e) => console.log("settled", e.txHash),
 * }));
 * app.get("/api/weather", (req, res) => res.json({ tempC: 12 }));
 * app.listen(3000);
 * ```
 */
export function x402(config: X402ExpressConfig): RequestHandler {
  const payTo = config.payTo;
  if (!payTo) throw new Error("[quinns-x402] payTo (your Base wallet) is required");
  const network = config.network ?? DEFAULT_NETWORK;
  const defaultPrice = config.price ?? DEFAULT_PRICE;
  const serviceName = config.serviceName ?? DEFAULT_SERVICE_NAME;

  const facilitatorClient = buildFacilitatorClient(config);
  const resourceServer = new x402ResourceServer(facilitatorClient);
  resourceServer.register(network, new ExactEvmScheme());
  // Enriches 402 responses with route/method info so the facilitator's
  // discovery index can catalog every route (mirrors the demo).
  resourceServer.registerExtension(bazaarResourceServerExtension);

  // challenge → settlement latency correlation, keyed by route pattern
  const challengeTs = new Map<string, number>();

  resourceServer.onAfterSettle(async (ctx) => {
    try {
      const result: any = ctx.result ?? {};
      const payload: any = ctx.paymentPayload ?? {};
      const requirements: any = ctx.requirements ?? {};
      const tx = result.transaction ?? "unknown";
      const payer =
        payload?.payer ??
        result?.payer ??
        payload?.payload?.authorization?.from ??
        "unknown";
      const amountUsdc = Number(requirements?.amount ?? "0") / 1e6;
      const priceUsdc = priceToUsdc(requirements?.price ?? defaultPrice);
      const transportRequest: any = (ctx?.transportContext as any)?.request ?? {};
      const routeKey = resolveRouteKey(
        config.routes,
        transportRequest.routePattern ??
          transportRequest.path ??
          requirements?.resource ??
          "unknown-route",
      );
      const chTs = challengeTs.get(routeKey);
      const latencyMs = chTs ? Date.now() - chTs : null;
      if (chTs) challengeTs.delete(routeKey);

      const event: SettlementEvent = {
        surface: "http",
        resource: routeKey,
        txHash: tx,
        payer,
        payee: payTo,
        amountUsdc,
        priceUsdc,
        latencyMs,
        ip: "unknown",
        userAgent: "unknown",
        sessionId: "unknown",
        args: undefined,
        at: new Date(),
        paymentPayload: ctx.paymentPayload,
        paymentRequirements: ctx.requirements,
      };
      await runCallbacks(config.onSettlement, async (cb) => {
        await cb(event);
      });
      console.log(`[quinns-x402] ${routeKey} settled ${tx} — $${amountUsdc} from ${payer}`);
    } catch (e) {
      console.error("[quinns-x402] settlement callback failed (fail-open):", (e as Error).message);
    }
  });

  const routes: RoutesConfig = {};
  for (const [key, def] of Object.entries(config.routes)) {
    const space = key.indexOf(" ");
    const method = space > 0 ? key.slice(0, space).toUpperCase() : "GET";
    const path = space > 0 ? key.slice(space + 1) : key;
    const price = def.price ?? defaultPrice;
    const isBody = method !== "GET" && method !== "DELETE";
    const extensionConfig: Record<string, unknown> = {
      method,
      description: def.description,
      inputSchema: def.inputSchema,
    };
    if (isBody) {
      extensionConfig.bodyType = "json";
      if (def.example?.input !== undefined) extensionConfig.input = def.example.input;
    } else if (def.example?.input !== undefined) {
      extensionConfig.input = def.example.input;
    }
    if (def.example?.output !== undefined) extensionConfig.output = { example: def.example.output };
    routes[key] = {
      accepts: { scheme: "exact", network, payTo, price },
      description: def.description,
      resource: config.resourceBaseUrl ? config.resourceBaseUrl + path : undefined,
      serviceName,
      tags: def.tags ?? config.tags,
      mimeType: def.mimeType ?? "application/json",
      extensions: declareDiscoveryExtension(extensionConfig as any),
    };
  }

  const httpServer = new x402HTTPResourceServer(resourceServer, routes).onProtectedRequest(
    async (ctx) => {
      // No X-PAYMENT header → this request is about to be served a 402.
      if (ctx.paymentHeader) return;
      try {
        const routeKey = resolveRouteKey(config.routes, ctx.routePattern ?? `${ctx.method} ${ctx.path}`);
        const routeDef = config.routes[routeKey] ?? {};
        const priceUsdc = priceToUsdc(routeDef.price ?? defaultPrice);
        challengeTs.set(routeKey, Date.now());
        const adapter = ctx.adapter;
        const xff = adapter.getHeader("x-forwarded-for") ?? adapter.getHeader("x-real-ip");
        const event: ChallengeEvent = {
          surface: "http",
          resource: routeKey,
          priceUsdc,
          ip: xff?.split(",")[0]?.trim() || "unknown",
          userAgent: adapter.getUserAgent() || "unknown",
          sessionId: "unknown",
          args: { query: adapter.getQueryParams?.() ?? {}, body: safeBody(adapter) },
          at: new Date(),
        };
        await runCallbacks(config.onChallenge, async (cb) => {
          await cb(event);
        });
      } catch (e) {
        console.error("[quinns-x402] challenge callback failed (fail-open):", (e as Error).message);
      }
    },
  );

  return paymentMiddlewareFromHTTPServer(httpServer, config.paywallConfig);
}

/** Resolve "GET /api/weather" style config keys from a path, URL, or pattern.
 * Keys are exact path matches (ignoring query strings and method prefixes). */
function resolveRouteKey(routes: Record<string, PaidRouteDef>, hint: string): string {
  const pathOf = (s: string) => {
    try {
      return new URL(s).pathname;
    } catch {
      return s.split("?")[0];
    }
  };
  const target = pathOf(hint);
  for (const [key] of Object.entries(routes)) {
    const path = key.slice(key.indexOf(" ") + 1);
    if (pathOf(path) === target) return key;
  }
  return target;
}

function safeBody(adapter: { getBody?: () => unknown }): unknown {
  try {
    const b = adapter.getBody?.();
    if (b === undefined || b === null) return undefined;
    return JSON.parse(JSON.stringify(b));
  } catch {
    return undefined;
  }
}

// Re-export so clients don't have to import @x402/express directly.
export type { PaywallConfig };
export type { PaymentRequiredContext };
