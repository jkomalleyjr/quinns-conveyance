// Test client: unpaid fetch (expect 402 + bazaar extension), then a real paid
// fetch through PayAI on Base mainnet ($0.005, buyer wallet from buyer-key.txt).
// Run while test-server.ts is up: npx tsx test/pay-client.ts
import { readFileSync } from "fs";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, decodePaymentResponseHeader } from "@x402/fetch";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const PORT = Number(process.env.PORT ?? 4031);
const URL = `http://localhost:${PORT}/api/answer?q=meaning+of+life`;

const REQUIRED_HEADER = "PAYMENT-REQUIRED";
const RESPONSE_HEADER = "PAYMENT-RESPONSE";

// --- 1. Unpaid: expect 402 with bazaar discovery extension in PAYMENT-REQUIRED ---
const raw = await fetch(URL);
console.log("[test] unpaid status:", raw.status);
const requiredHeader = raw.headers.get(REQUIRED_HEADER);
if (raw.status !== 402 || !requiredHeader) {
  console.error("[test] FAIL: expected 402 with PAYMENT-REQUIRED header");
  process.exit(1);
}
const paymentRequired: any = decodePaymentRequiredHeader(requiredHeader);
const accepts = paymentRequired?.accepts?.[0];
console.log("[test] 402 accepts amount:", accepts?.amount, "| payTo:", accepts?.payTo, "| network:", accepts?.network);
const bazaar = paymentRequired?.extensions?.bazaar;
console.log("[test] 402 carries extensions.bazaar:", Boolean(bazaar));
if (bazaar) console.log("[test] bazaar info:", JSON.stringify(bazaar.info).slice(0, 200));
if (!bazaar || accepts?.amount !== "5000" || accepts?.network !== "eip155:8453") {
  console.error("[test] FAIL: missing bazaar extension or wrong payment terms");
  process.exit(1);
}
console.log("[test] PASS: 402 + bazaar extension");

// --- 2. Paid: sign an EIP-3009 auth with the throwaway buyer wallet ---
const PRIVATE_KEY = readFileSync(
  process.env.HOME + "/workspace/x402-pipeline/demo/buyer-key.txt",
  "utf8",
).trim();
const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
console.log("[test] buyer:", account.address);

const client = new x402Client().register("eip155:8453", new ExactEvmScheme(account));
const paidFetch = wrapFetchWithPayment(fetch, client);

const res = await paidFetch(URL);
console.log("[test] paid status:", res.status);
console.log("[test] paid body:", (await res.text()).slice(0, 200));

const paymentResponse = res.headers.get(RESPONSE_HEADER);
if (paymentResponse) {
  const decoded: any = decodePaymentResponseHeader(paymentResponse);
  console.log("[test] settlement tx:", decoded?.transaction);
  console.log("[test] settlement success:", decoded?.success);
} else {
  console.log("[test] no PAYMENT-RESPONSE header (settlement may be echoed in body)");
}
console.log("[test] done");
