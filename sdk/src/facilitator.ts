/**
 * Facilitator client construction — shared by the Express and MCP surfaces.
 *
 * Default: PayAI facilitator over plain HTTP (no auth).
 * With `config.cdp`: Coinbase CDP facilitator — createCdpFacilitatorClient
 * returns an HTTPFacilitatorClient bound to
 * https://api.cdp.coinbase.com/platform/v2/x402 that signs a short-lived JWT
 * per request from the API key secret. Settlements through CDP are what get
 * an endpoint indexed in the CDP Bazaar (and from there, Agentic.market).
 */
import { HTTPFacilitatorClient, type FacilitatorClient } from "@x402/core/server";
import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";
import type { QuinnBaseConfig } from "./types.js";

export const DEFAULT_FACILITATOR_URL = "https://facilitator.payai.network";

export function buildFacilitatorClient(
  config: Pick<QuinnBaseConfig, "facilitatorUrl" | "cdp">,
): FacilitatorClient {
  if (config.cdp) {
    const { keyId, keySecret } = config.cdp;
    if (!keyId || !keySecret) {
      throw new Error(
        "[quinns-x402] cdp config requires both keyId and keySecret " +
          "(create a Secret API Key at https://portal.cdp.coinbase.com)",
      );
    }
    // FacilitatorClient is an interface, so the CDP client's HTTPFacilitatorClient
    // (typed against @x402/core's CJS declarations) is structurally compatible.
    return createCdpFacilitatorClient({ apiKeyId: keyId, apiKeySecret: keySecret });
  }
  return new HTTPFacilitatorClient({
    url: config.facilitatorUrl ?? DEFAULT_FACILITATOR_URL,
  });
}
