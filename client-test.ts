// Test client: pays for one tool call and prints the settlement tx hash.
// Uses Base Sepolia by default (free testnet). Point at mainnet only for the
// single proof settlement.
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createx402MCPClient } from "@x402/mcp";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const PORT = Number(process.env.PORT ?? 4021);
const NETWORK = (process.env.X402_NETWORK ?? "eip155:84532") as `${string}:${string}`;
const PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY as `0x${string}`;

if (!PRIVATE_KEY) throw new Error("CLIENT_PRIVATE_KEY is required (test buyer wallet)");

const account = privateKeyToAccount(PRIVATE_KEY);
console.log(`Buyer: ${account.address} on ${NETWORK}`);

const client = createx402MCPClient({
  name: "demo-buyer",
  version: "0.1.0",
  schemes: [{ network: NETWORK, client: new ExactEvmScheme(account) }],
  autoPayment: true,
  onPaymentRequested: async ({ paymentRequired }) => {
    console.log(`Payment requested: ${JSON.stringify(paymentRequired.accepts[0]).slice(0, 200)}`);
    return true;
  },
});

const transport = new StreamableHTTPClientTransport(new URL(`http://localhost:${PORT}/mcp`));
await client.connect(transport);

const tools = await client.listTools();
console.log("Tools:", tools.tools.map((t) => t.name).join(", "));

const result = await client.callTool("fix_comfyui_api_prompt_error", {
  query: "V3 SaveVideo missing format error in API prompt",
});
console.log("Result:", JSON.stringify(result.content, null, 2).slice(0, 1500));
if ((result as any).paymentMade) {
  console.log("Settled tx:", (result as any).paymentResponse?.transaction);
  console.log("Verify on BaseScan (Sepolia): https://sepolia.basescan.org");
}

await client.close();
process.exit(0);
