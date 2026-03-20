# gateflare

A Cloudflare Workers API gateway you configure with a TOML file and deploy in five minutes.

Just a `wrangler.toml` and `wrangler deploy`.

---

## What it does

- **Hides your upstream API keys** — secrets are stored encrypted, injected at the edge, never sent to the client
- **Rate limits traffic** — sliding window per IP or globally, configurable per route
- **Blocks unwanted IPs** — optional allowlist backed by Workers KV
- **Rewrites paths** — map `/openai/*` to `api.openai.com` with prefix stripping
- **Logs everything** — structured JSON, four levels, Logpush-ready
- **Backs up logs to R2** — daily `.jsonl` files, opt-in, never blocks a request

---

## Getting started

You'll need [Wrangler](https://developers.cloudflare.com/workers/wrangler/) and a Cloudflare account.

```bash
git clone https://github.com/yourname/gateflare
cd gateflare
npm install
```

Copy the template config and edit it:

```bash
cp wrangler.example.toml wrangler.toml
```

Add your first upstream secret:

```bash
wrangler secret put OPENAI_API_KEY
```

Deploy:

```bash
wrangler deploy
```

Your gateway is live. Requests to `your-worker.workers.dev/openai/*` are now proxied to `api.openai.com` with your key injected automatically.

---

## Configuration

Everything lives in `wrangler.toml`. The `[gateway]` block is yours — Wrangler ignores it, gateflare reads it.

```toml
name               = "gateflare"
main               = "src/index.ts"
compatibility_date = "2025-01-01"

[[kv_namespaces]]
binding = "GATEWAY_KV"
id      = "your-kv-namespace-id"

[gateway]
log_level   = "info"       # debug | info | warn | error
environment = "production"

[gateway.rate_limit]
enabled        = false     # off by default
requests       = 100
window_seconds = 60
by             = "ip"      # "ip" | "global"

[gateway.ip_allowlist]
enabled = false            # off by default
allow   = [
  "203.0.113.42",
  "198.51.100.0/24",
]

[[gateway.routes]]
path       = "/openai/*"
upstream   = "https://api.openai.com"
secret_ref = "OPENAI_API_KEY"
auth_style = "bearer"

  [gateway.routes.rewrite]
  strip_prefix = "/openai"

  [gateway.routes.headers]
  strip  = ["origin", "cf-connecting-ip"]
  inject = { "openai-beta" = "assistants=v2" }
```

### Routes

Routes match top to bottom, first match wins. Each route needs at minimum a `path`, an `upstream`, and a `secret_ref`.

| field | required | description |
|---|---|---|
| `path` | yes | glob pattern e.g. `/openai/*` |
| `upstream` | yes | full URL of the upstream API |
| `cors` | no | CORS settings for the route |
| `secret_ref` | yes | name of the Worker secret to inject |
| `auth_style` | no | `bearer` (default) or `header` |
| `auth_header` | no | custom header name when `auth_style = "header"` |

Each route can also have these optional sub-tables:

- `rewrite`: Path rewriting rules.
- `rate_limit`: Per-route rate limit override.
- `cors`: Per-route CORS override.
- `headers`: Header manipulation (strip/inject).

### Per-route rate limits

Override the global rate limit for a specific route:

```toml
[[gateway.routes]]
path       = "/anthropic/*"
upstream   = "https://api.anthropic.com"
secret_ref = "ANTHROPIC_API_KEY"
auth_style = "header"
auth_header = "x-api-key"

  [gateway.routes.rate_limit]
  enabled        = true
  requests       = 30
  window_seconds = 60
```

### R2 log backup

Daily log backups to an R2 bucket. Off by default — add this to opt in:

```toml
[[r2_buckets]]
binding     = "GATEWAY_LOGS"
bucket_name = "gateflare-logs"

[gateway.r2_backup]
enabled = true
bucket  = "GATEWAY_LOGS"
prefix  = "logs/"
```

Logs land at `logs/2026-03-20.jsonl` — one JSON object per line. If R2 is unavailable, gateflare fails silently and never blocks the request.

---

## Logging

Every log line is a JSON object written to `console.log`. Works with Cloudflare's [Logpush](https://developers.cloudflare.com/logs/logpush/) out of the box since the format never changes.

```json
{
  "level": "info",
  "timestamp": "2026-03-20T10:00:00Z",
  "request_id": "a1b2c3",
  "route": "/openai/*",
  "message": "request forwarded",
  "meta": {
    "status": 200,
    "duration_ms": 42,
    "upstream": "https://api.openai.com",
    "ip": "203.0.113.42"
  }
}
```

Set `log_level = "debug"` locally to see every header mutation, KV read, and path rewrite. Set it to `warn` in production to only hear about problems.

---

## Examples

The `examples/` folder has ready-to-use configs for common setups:

- `openai.toml` — proxy OpenAI with rate limiting
- `stripe.toml` — proxy Stripe, strip browser headers
- `multi-route.toml` — multiple upstreams in one gateway

---

## How it works

Each request goes through a fixed pipeline:

```
incoming request
  → match route
  → IP allowlist check     (if enabled)
  → rate limit check       (per-route → global fallback)
  → rewrite path
  → strip request headers
  → inject upstream secret
  → inject extra headers
  → forward to upstream
  → sanitize response headers
  → log
  → return to client
```

State (rate limit counters, IP lists) lives in Workers KV. Secrets live in Cloudflare's encrypted secret store. Nothing sensitive ever touches the config file.

---

## What it doesn't do

Deliberately left out to keep things simple:

- No consumer authentication (JWT, API keys, OAuth)
- No request/response body transforms
- No web UI or dashboard
- No managed hosting

If you need these, there are heavier tools built for it. gateflare is for the case where you just need a key hidden and some traffic controlled, without running infrastructure.

---

## Contributing

Issues and PRs are welcome. If you're adding a feature, open an issue first so we can talk about whether it belongs in core.

The codebase is one file per concern — `router.ts` does routing, `ratelimit.ts` does rate limiting, nothing bleeds into anything else. Keep it that way.

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run dev         # wrangler dev
```

---

## License

MIT