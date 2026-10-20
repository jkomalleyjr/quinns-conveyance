// Make a $0.005 payment, capture the full EIP-3009 auth + tx hash
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "fs";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createx402MCPClient } from "@x402/mcp";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const PRIVATE_KEY = readFileSync(process.env.HOME + "/workspace/x402-pipeline/demo/buyer-key.txt", "utf8").trim();
const account = privateKeyToAccount(PRIVATE_KEY);

const scheme = new ExactEvmScheme(account);

// Wrap createPaymentPayload to capture the signed auth
const origCreate = scheme.createPaymentPayload.bind(scheme);
scheme.createPaymentPayload = async (...args) => {
  const result = await origCreate(...args);
  console.log("=== CAPTURED PAYMENT PAYLOAD ===");
  writeFileSync("/tmp/captured-payload.json", JSON.stringify(result, null, 2));
  console.log("Saved payload");
  return result;
};

const client = createx402MCPClient({
  name: "capture-test",
  version: "1.0.0",
  schemes: [{ network: "eip155:8453", client: scheme }],
  autoPayment: true,
});

const transport = new StreamableHTTPClientTransport(new URL("https://demo.quinnsconveyance.com/mcp"));
await client.connect(transport);

const result = await client.callTool(process.argv[2], {
  query: "capture test for Flow Executor verification",
});

console.log("Tool result received");
if (result.paymentMade) {
  console.log("Settled tx:", result.paymentResponse?.transaction);
  writeFileSync("/tmp/captured-tx.txt", result.paymentResponse?.transaction || "");
}

await client.close();
console.log("Done");
