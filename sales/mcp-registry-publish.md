# MCP Registry — publish instructions for the Quinn's Conveyance demo

Prepared Oct 19, 2026. Everything is ready except the interactive GitHub OAuth
login, which only you can do (it opens a browser device-code flow).

## What's ready

- `server.json` at `~/workspace/x402-pipeline/demo/server.json`
  - name: `io.github.jkomalleyjr/quinns-conveyance`
  - version: `0.1.0`
  - remote: `https://demo.quinnsconveyance.com/mcp` (streamable-http)
  - repository: `https://github.com/jkomalleyjr/quinns-conveyance`
  - website: `https://demo.quinnsconveyance.com`
- Validated against the current registry schema
  (`https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`)
  — PASS, including the schema's 100-character description limit.

## Step 1 — install mcp-publisher

macOS / Linux / WSL, pick one:

Homebrew:

```
brew install mcp-publisher
```

Or download the release binary (run in a scratch dir):

```
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher
```

## Step 2 — log in with GitHub (grants the io.github.jkomalleyjr namespace)

```
cd ~/workspace/x402-pipeline/demo
./mcp-publisher login github
```

(If installed via Homebrew, it's just `mcp-publisher` without the `./`.)

The CLI prints a link and a device code (like `ABCD-1234`). Open the link in a
browser signed in as **jkomalleyjr**, enter the code, approve. The terminal
confirms once the flow completes.

## Step 3 — publish

```
./mcp-publisher publish server.json
```

Success output confirms the server name and version. The registry validates
the manifest server-side at publish time.

## Step 4 — verify the listing

- Registry homepage: https://registry.modelcontextprotocol.io — search for
  `quinns-conveyance`.
- API check (the registry's v0 search endpoint):
  `https://registry.modelcontextprotocol.io/v0/servers?search=quinns-conveyance`
  should return the entry with status active.
- Downstream sync: Smithery, PulseMCP, and Glama ingest from the official
  registry, so the demo appears there automatically after the registry listing
  goes live — no separate submissions needed. (Sync timing varies; check each
  site a few days later.)

## ⚠️ Known risk: remote-URL namespace check

The registry validator may require the remote URL to match the namespace
domain. `io.github.jkomalleyjr` maps to `jkomalleyjr.github.io`, but the demo
runs on `demo.quinnsconveyance.com`. Community reports say remote servers on
custom domains (Cloudflare Workers, AWS Lambda, Railway) have been rejected
for exactly this mismatch.

If Step 3 fails with a namespace/URL mismatch error, use the DNS-auth fallback
— you own quinnsconveyance.
...[truncated 1745 chars]