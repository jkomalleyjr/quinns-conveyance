import { Pool } from "pg";
import type {
  ChallengeCallback,
  ChallengeEvent,
  SettlementCallback,
  SettlementEvent,
  VerifyStatus,
} from "./types.js";
import { verifySettlement, type VerifyOptions } from "./verify.js";

export interface SettlementLoggerOptions {
  /**
   * Run Flow Executor verification on each settlement and store
   * verify_status on the payment row. Default false.
   */
  verify?: boolean;
  verifyOptions?: VerifyOptions;
  /**
   * The instant verification races chain propagation — the verifier can read
   * state before the settlement is visible to its node, producing false
   * "failed" results (the signature is authorizationState/window FAILs
   * seconds after a good settlement). When the first check comes back
   * "failed", re-check once after this delay and replace the row if the
   * re-check reaches a verdict, stamped with recheck provenance. A re-check
   * that cannot reach a verdict never downgrades the original result.
   * Default 30000. Set 0 to disable.
   */
  verifyRecheckDelayMs?: number;
}

export interface SettlementLogger {
  onChallenge: ChallengeCallback;
  onSettlement: SettlementCallback;
  /** Write a verify result onto an existing payment row. */
  updateVerifyStatus: (
    txHash: string,
    status: VerifyStatus,
    detail: string,
    verified: boolean,
  ) => Promise<void>;
  /** Underlying pg pool, if you want custom queries. */
  pool: Pool;
  close: () => Promise<void>;
}

/**
 * Postgres settlement ledger matching the schema in schema.sql
 * (the same payments/challenges tables the Quinn's Conveyance demo uses).
 *
 * All writes fail-open: a down database logs an error but never breaks a
 * payment response.
 */
export function createSettlementLogger(
  connectionString: string,
  opts: SettlementLoggerOptions = {},
): SettlementLogger {
  const pool = new Pool({ connectionString });
  pool.on("error", (e) => console.error("[quinns-x402][pg] pool error:", e.message));

  // challenge → settlement latency correlation, keyed by resource (same as demo)
  const challengeTs = new Map<string, number>();

  const updateVerifyStatus = async (
    txHash: string,
    status: VerifyStatus,
    detail: string,
    verified: boolean,
  ) => {
    await pool.query(
      `UPDATE payments SET verified = $1, verify_detail = $2, verify_status = $3 WHERE tx_hash = $4`,
      [verified, detail, status, txHash],
    );
  };

  const onChallenge: ChallengeCallback = async (e: ChallengeEvent) => {
    challengeTs.set(e.resource, e.at.getTime());
    try {
      await pool.query(
        `INSERT INTO challenges (tool_name, tool_args, price_offered_usdc, payer_ip, user_agent, session_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          e.resource,
          JSON.stringify(e.args ?? {}),
          e.priceUsdc,
          e.ip || "unknown",
          e.userAgent || "unknown",
          e.sessionId || "unknown",
        ],
      );
    } catch (err) {
      console.error("[quinns-x402][ledger] challenge log failed:", (err as Error).message);
    }
  };

  const onSettlement: SettlementCallback = async (e: SettlementEvent) => {
    const chTs = challengeTs.get(e.resource);
    const latencyMs = e.latencyMs ?? (chTs ? e.at.getTime() - chTs : null);
    if (chTs) challengeTs.delete(e.resource);
    try {
      await pool.query(
        `INSERT INTO payments (tx_hash, payer, payee, amount_usdc, tool_name, tool_args, price_offered_usdc, payer_ip, user_agent, challenge_to_settlement_ms, session_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (tx_hash) DO NOTHING`,
        [
          e.txHash,
          e.payer,
          e.payee,
          e.amountUsdc,
          e.resource,
          JSON.stringify(e.args ?? {}),
          e.priceUsdc,
          e.ip || "unknown",
          e.userAgent || "unknown",
          latencyMs,
          e.sessionId || "unknown",
        ],
      );
    } catch (err) {
      console.error("[quinns-x402][ledger] settlement log failed:", (err as Error).message);
      return; // nothing to verify against if the row never landed
    }
    // --- Optional Flow Executor verification (fail-open-but-loud) ---
    if (opts.verify) {
      const vr = await verifySettlement(e, opts.verifyOptions);
      try {
        await updateVerifyStatus(e.txHash, vr.status, vr.detail, vr.verified);
      } catch (err) {
        console.error("[quinns-x402][ledger] verify update failed:", (err as Error).message);
      }
      // Delayed re-check: a definitive "failed" gets one retry after the
      // propagation window (see verifyRecheckDelayMs). Mirrors the demo,
      // where the +30s re-check flipped a raced "failed" to "verified".
      const recheckDelayMs = opts.verifyRecheckDelayMs ?? 30_000;
      if (vr.status === "failed" && recheckDelayMs > 0) {
        const t = setTimeout(() => {
          (async () => {
            const vr2 = await verifySettlement(e, opts.verifyOptions);
            if (vr2.status === "verified" || vr2.status === "failed") {
              const label = `recheck@${Math.round(recheckDelayMs / 1000)}s: `;
              try {
                await updateVerifyStatus(e.txHash, vr2.status, label + vr2.detail, vr2.verified);
              } catch (err) {
                console.error("[quinns-x402][ledger] verify recheck update failed:", (err as Error).message);
              }
            }
          })().catch(() => {});
        }, recheckDelayMs);
        (t as any).unref?.();
      }
    }
  };

  return {
    onChallenge,
    onSettlement,
    updateVerifyStatus,
    pool,
    close: () => pool.end(),
  };
}
