/**
 * Shared configuration and event types for quinns-x402.
 *
 * Everything defaults to the proven setup: PayAI facilitator, Base mainnet,
 * USDC via EIP-3009 exact, $0.005/call.
 */

export type Network = `${string}:${string}`;

/** A single event callback; never throws — callbacks are invoked fail-open. */
export type ChallengeCallback = (e: ChallengeEvent) => void | Promise<void>;
export type SettlementCallback = (e: SettlementEvent) => void | Promise<void>;

/** Emitted when a request is challenged with a 402 (unpaid, no X-PAYMENT). */
export interface ChallengeEvent {
  /** "http" for Express routes, "mcp" for MCP tools. */
  surface: "http" | "mcp";
  /** Route pattern ("GET /api/weather") or MCP tool name. */
  resource: string;
  /** Price offered in this challenge, in USDC. */
  priceUsdc: number;
  ip: string;
  userAgent: string;
  sessionId: string;
  /** Query/body (http) or tool arguments (mcp), JSON-safe. */
  args?: unknown;
  at: Date;
}

/** Emitted after a payment settles on-chain. */
export interface SettlementEvent extends Omit<ChallengeEvent, "args"> {
  txHash: string;
  payer: string;
  /** Wallet the payment settled to. */
  payee: string;
  /** Actually settled amount in USDC. */
  amountUsdc: number;
  /** Price offered when challenged, in USDC. */
  priceUsdc: number;
  /** Tool args (mcp) or query/body snapshot (http), JSON-safe. */
  args?: unknown;
  /** ms from challenge to settlement, when a matching challenge was seen. */
  latencyMs: number | null;
  /** Raw payment payload — needed for signature verification. */
  paymentPayload?: unknown;
  /** Raw payment requirements — needed for signature verification. */
  paymentRequirements?: unknown;
}

/** Base config shared by both surfaces. */
export interface QuinnBaseConfig {
  /** Wallet that receives settlement, e.g. "0x3a97…28C". Required. */
  payTo: string;
  /** Per-call price, e.g. "$0.005". Default "$0.005". */
  price?: string;
  /** CAIP-2 network id. Default "eip155:8453" (Base mainnet). */
  network?: Network;
  /** Facilitator URL. Default "https://facilitator.payai.network". Ignored when `cdp` is set. */
  facilitatorUrl?: string;
  /**
   * Coinbase CDP facilitator credentials. When set, settlements route through
   * the CDP facilitator (https://api.cdp.coinbase.com/platform/v2/x402) with
   * per-request JWT auth signed from the key secret — and settled endpoints
   * get indexed in the CDP Bazaar + Agentic.market. Create a Secret API Key
   * at https://portal.cdp.coinbase.com (API Keys tab); `keyId` is the key's
   * name/ID and `keySecret` its private key (PEM EC or base64 Ed25519),
   * exactly as downloaded. When set, `facilitatorUrl` is ignored.
   */
  cdp?: CdpFacilitatorConfig;
  /** Human-readable service name for bazaar metadata. Default "Quinn's Conveyance". */
  serviceName?: string;
  /** Tags for bazaar metadata. */
  tags?: string[];
  onChallenge?: ChallengeCallback | ChallengeCallback[];
  onSettlement?: SettlementCallback | SettlementCallback[];
}

/** CDP API key credentials for the Coinbase CDP facilitator. */
export interface CdpFacilitatorConfig {
  /** CDP API key ID (the key name from the portal, e.g. "organizations/…/apiKeys/…"). */
  keyId: string;
  /** CDP API key secret (private key, exactly as downloaded from the portal). */
  keySecret: string;
}

/** Verification result state — the gap is visible, never silent. */
export type VerifyStatus =
  | "verified"
  | "failed"
  | "unverified_verifier_down"
  | "unverified_error";

/** Run callbacks fail-open: one throwing callback never breaks the rest or the response. */
export async function runCallbacks<T>(
  callbacks: undefined | T | T[],
  fn: (cb: T) => Promise<void>,
): Promise<void> {
  if (!callbacks) return;
  const list = Array.isArray(callbacks) ? callbacks : [callbacks];
  for (const cb of list) {
    try {
      await fn(cb);
    } catch (e) {
      console.error("[quinns-x402] callback failed (fail-open):", (e as Error).message);
    }
  }
}

/** Parse a price like "$0.005" to a USDC number. */
export function priceToUsdc(price: string): number {
  const n = Number(String(price).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Error(`[quinns-x402] invalid price: ${price}`);
  return n;
}
