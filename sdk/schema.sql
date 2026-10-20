-- quinns-x402 settlement ledger schema (same tables the Quinn's Conveyance demo uses)
-- Apply with: psql <connection-string> -f schema.sql

-- Every 402 challenge served (the funnel: challenges vs settlements).
CREATE TABLE IF NOT EXISTS challenges (
    id                 BIGSERIAL PRIMARY KEY,
    tool_name          TEXT NOT NULL,              -- route pattern ("GET /api/x") or MCP tool name
    tool_args          JSONB DEFAULT '{}'::jsonb,  -- query/body (http) or tool arguments (mcp)
    price_offered_usdc NUMERIC(18, 6) NOT NULL,
    payer_ip           TEXT DEFAULT 'unknown',
    user_agent         TEXT DEFAULT 'unknown',
    session_id         TEXT DEFAULT 'unknown',
    challenged_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every settled payment.
CREATE TABLE IF NOT EXISTS payments (
    id                        BIGSERIAL PRIMARY KEY,
    tx_hash                   TEXT UNIQUE,         -- on-chain settlement tx (Base)
    payer                     TEXT NOT NULL,
    payee                     TEXT NOT NULL,
    amount_usdc               NUMERIC(18, 6) NOT NULL,
    tool_name                 TEXT NOT NULL,
    tool_args                 JSONB DEFAULT '{}'::jsonb,
    price_offered_usdc        NUMERIC(18, 6) NOT NULL,
    payer_ip                  TEXT DEFAULT 'unknown',
    user_agent                TEXT DEFAULT 'unknown',
    challenge_to_settlement_ms BIGINT,
    session_id                TEXT DEFAULT 'unknown',
    block_number              BIGINT,
    settled_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified                  BOOLEAN,
    verify_detail             TEXT,
    verify_status             TEXT NOT NULL DEFAULT 'unverified'
        CHECK (verify_status IN ('verified', 'failed', 'unverified_verifier_down', 'unverified_error', 'unverified'))
);

CREATE INDEX IF NOT EXISTS payments_settled_at_idx ON payments (settled_at);
CREATE INDEX IF NOT EXISTS payments_tool_name_idx ON payments (tool_name);
CREATE INDEX IF NOT EXISTS challenges_challenged_at_idx ON challenges (challenged_at);
