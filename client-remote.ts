// Test client against a remote (public URL) demo server.
// BASE_URL=https://host npx tsx client-remote.ts
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createx402MCPClient } from "@x402/mcp";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4021";
const NETWORK = (process.env.X402_NETWORK ?? "eip155:84532") as `${string}:${string}`;
const PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY as `0x${string}`;

if (!PRIVATE_KEY) throw new Error("CLIENT_PRIVATE_KEY is required (test buyer wallet)");

const account = privateKeyToAccount(PRIVATE_KEY);
console.log(`Buyer: ${account.address} on ${NETWORK} -> ${BASE_URL}`);

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

const transport = new StreamableHTTPClientTransport(new URL(`${BASE_URL}/mcp`));
await client.connect(transport);

const result = await client.callTool("get_chaining_rule", {
  query: "how do I chain two H3 clips",
});
console.log("Result:", JSON.stringify(result.content).slice(0, 300));
if ((result as any).paymentMade) {
  console.log("Settled tx:", (result as any).paymentResponse?.transaction);
  console.log("Verify: https://basescan.org");
}

await client.close();
process.exit(0);
