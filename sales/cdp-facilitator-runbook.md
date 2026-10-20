# CDP Facilitator Runbook — switch the demo to Coinbase CDP

**Goal:** settle the demo's payments through the Coinbase CDP facilitator so the
tools get indexed in the **CDP Bazaar** (and from there, **Agentic.market**).
PayAI stays the default; CDP is one env switch away and fully reversible.

**Code status (done Oct 19):** `server.ts` supports `FACILITATOR=payai|cdp`.
CDP auth = `createCdpFacilitatorClient` from `@coinbase/cdp-sdk/x402`
(signs a short-lived JWT per request from the API key secret). Deps
`@coinbase/cdp-sdk` + `@x402/svm` are in the demo's package.json. The SDK
(`quinns-x402`, `~/workspace/x402-pipeline/sdk/`) has the same support via
`cdp: { keyId, keySecret }` in config — rebuilt, not yet published.

**Pricing:** verify is always free; first **1,000 onchain settlement
transactions/month free**, then $0.001 each (CDP facilitator pricing page).

---

## Step 1 — USER: create the CDP API key (only manual step)

1. Go to https://portal.cdp.coinbase.com and sign in (or create a CDP account —
   a Coinbase account works).
2. Open the **API Keys** tab → **Secret API Key** section → **Create API key**.
3. Nickname: `quinns-conveyance-facilitator`. Restrictions are optional; if you
   set an IP allowlist, use the VM's static IP: `136.109.78.181`.
   No special x402 permission scope exists or is needed — a standard Secret API
   Key authenticates facilitator verify/settle (per CDP's x402 FAQ).
4. **Download the key file and keep it safe — the secret is shown only once.**
   The file contains two values you need:
   - **Key name / ID** (looks like `organizations/<org-id>/apiKeys/<key-id>`)
     → becomes `CDP_API_KEY_ID`.
   - **Private key** (an Ed25519 base64 secret or an ECDSA PEM block)
     → becomes `CDP_API_KEY_SECRET`. Copy it **exactly** as in the file.
5. Paste both values to Muse (or put them straight into the VM `.env` in
   Step 3 yourself). Never commit them to git.

## Step 2 — Deploy the updated server to the VM

From this workspace (`~/workspace/x402-pipeline/demo`):

```bash
# copy code + dependency manifests (same proxy pattern as gcp_ssh.sh)
P="${HTTPS_PROXY}"; PH="${P#*://}"; AUTH="${PH%@*}"; HH="${PH#*@}"; HH="${HH%:*}"
scp -i ~/.ssh/id_ed25519 \
  -o "ProxyCommand=socat STDIO PROXY:$HH:136.109.78.181:22,proxyport=3128,proxyauth=$AUTH" \
  -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  server.ts package.json package-lock.json deployer@136.109.78.181:~/x402-demo/

# install the new deps on the VM
~/workspace/gcp_ssh.sh 'cd ~/x402-demo && npm install'
```

## Step 3 — Set the VM env (`~/x402-demo/.env` on the VM)

Add:

```
FACILITATOR=cdp
CDP_API_KEY_ID=organizations/<org-id>/apiKeys/<key-id>
CDP_API_KEY_SECRET=<private key exactly as downloaded>
```

Notes:
- If the secret is an **ECDSA PEM** (starts with `-----BEGIN EC PRIVATE KEY-----`),
  wrap the value in double quotes and keep the line breaks inside the quotes —
  Node's `--env-file` parser handles multiline quoted values. Ed25519 secrets
  are single-line base64 and need no quoting.
- Leave `FACILITATOR_URL=https://facilitator.payai.network` in place — it's
  ignored in CDP mode and is the rollback path.

## Step 4 — Restart and confirm the switch

```bash
~/workspace/gcp_ssh.sh 'sudo systemctl restart x402-demo && sleep 3 && sudo journalctl -u x402-demo -n 20 --no-pager'
```

Expect the startup log line:

```
[x402] facilitator: cdp (https://api.cdp.coinbase.com/platform/v2/x402)
```

And `curl -s https://demo.quinnsconveyance.com/health` should still return ok.
If the keys are missing/wrong you get a clear `[x402] FATAL: FACILITATOR=cdp but
CDP_API_KEY_ID / CDP_API_KEY_SECRET are not set` (missing) or an initialize
failure from JWT signing (malformed secret) — fix the `.env`, restart again.

## Step 5 — Verify indexing (one paid call per tool)

From `~/workspace/x402-pipeline/demo` locally:

```bash
node capture-payment.mjs
```

(Uses the throwaway buyer wallet; each paid call is $0.005 USDC on Base
mainnet. Repeat per tool — like PayAI, CDP catalogs a tool only after its
first settlement through CDP.)

Then check the merchant listing (no auth needed):

```bash
curl -s "https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant?payTo=0x3a97d5F616D26876020568bD631492F59cFB428C" | head -c 1000
```

Tools should appear with resource `https://demo.quinnsconveyance.com/mcp`.
Agentic.market reads from the same Bazaar index — check
https://agentic.market and search "Quinn" / "ComfyUI" after the first
settlements land (indexing is not instant; give it a little time).

Also confirm the settlement landed in the ledger as usual:

```bash
~/workspace/gcp_ssh.sh 'sudo journalctl -u x402-demo -n 50 --no-pager | grep -E "\[ledger\]|\[verify\]"'
```

Expect a `[ledger] <tool> settled <tx>` line plus the Flow verify line —
settlement logging, the verifier, and `verify_status` are facilitator-agnostic
and work unchanged on CDP.

## Rollback

Set `FACILITATOR=payai` (or delete the line) in `~/x402-demo/.env` and restart
the service. PayAI resumes immediately; nothing else changes.

---

### Sources
- CDP Facilitator docs: https://docs.cdp.coinbase.com/x402/seller/facilitator
- CDP x402 FAQ (seller credentials): https://docs.cdp.coinbase.com/x402/support/faq
- `createCdpFacilitatorClient` — `@coinbase/cdp-sdk/x402` (v1.59.0),
  `CDP_FACILITATOR_URL = https://api.cdp.coinbase.com/platform/v2/x402`
