import type { SettlementEvent, VerifyStatus } from "./types.js";

export interface VerifyResult {
  status: VerifyStatus;
  verified: boolean;
  detail: string;
}

export interface VerifyOptions {
  /** Default "https://flow-kg4x.vercel.app/api/settlement-verify" */
  endpoint?: string;
  /** Abort budget in ms. Default 5000. */
  timeoutMs?: number;
}

/**
 * Verify a settlement with Flow Executor's 4-check verifier
 * (signature recovery, nonce consumption, transfer-log match, validity window).
 *
 * Fail-open-but-loud, mirroring the demo: this NEVER throws and never blocks.
 * An unreachable verifier comes back as `unverified_verifier_down` — the gap
 * is visible in whatever store consumes the result, not silent.
 */
export async function verifySettlement(
  event: SettlementEvent,
  opts: VerifyOptions = {},
): Promise<VerifyResult> {
  const endpoint = opts.endpoint ?? "https://flow-kg4x.vercel.app/api/settlement-verify";
  const timeoutMs = opts.timeoutMs ?? 5_000;
  try {
    const pp: any = event.paymentPayload;
    const auth = pp?.payload?.authorization ?? pp?.authorization;
    const sig: string | undefined = pp?.payload?.signature ?? pp?.signature;
    if (!auth || !sig || !event.txHash || event.txHash === "unknown") {
      return {
        status: "unverified_error",
        verified: false,
        detail: "verification skipped: missing auth/signature/tx",
      };
    }
    const r = "0x" + sig.slice(2, 66);
    const s = "0x" + sig.slice(66, 130);
    const v = parseInt(sig.slice(130), 16);
    const body = {
      authorization: {
        from: auth.from,
        to: auth.to,
        value: String(auth.value),
        validAfter: String(auth.validAfter ?? 0),
        validBefore: String(auth.validBefore),
        nonce: auth.nonce,
        v,
        r,
        s,
      },
      txHash: event.txHash,
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      return {
        status: "unverified_verifier_down",
        verified: false,
        detail: `verifier returned HTTP ${res.status}`,
      };
    }
    const vr: any = await res.json();
    const checks = (vr.checks ?? [])
      .map((c: any) => `${c.name}:${c.pass ? "PASS" : "FAIL"}`)
      .join(" ");
    const verified = vr.verified === true;
    return { status: verified ? "verified" : "failed", verified, detail: checks };
  } catch (e) {
    const msg = (e as Error).message;
    const isDown =
      msg.includes("abort") ||
      msg.includes("fetch") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("timeout");
    return {
      status: isDown ? "unverified_verifier_down" : "unverified_error",
      verified: false,
      detail: `verifier unreachable: ${msg.slice(0, 100)}`,
    };
  }
}
