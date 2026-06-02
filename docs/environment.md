---
title: Environment variables
summary: Required and optional env vars for Vercel MCP deployments.
audience:
  - human
  - agent
when_to_read: Configuring Vercel, local dev, or documenting consumer deployments.
prerequisites: []
---

# Environment variables

| Variable | Required where | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Vercel + local | Supabase project URL (`https://xxx.supabase.co` or local `http://127.0.0.1:54321`) |
| `SUPABASE_ANON_KEY` | Vercel + local | Anon key for JWT validation and OAuth UI |
| `SUPABASE_AUTH_URL` | Optional | Override auth server URL (default `{SUPABASE_URL}/auth/v1`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Enables `mcp.interaction_log` audit inserts/updates |
| `SERVICE_ROLE_KEY` | Optional | Alias accepted by audit module (Supabase CLI shape) |
| `API_URL` | Optional | Alias for `SUPABASE_URL` (Supabase CLI `status -o env`) |
| `VERCEL_MCP_LOG_LEVEL` | Optional | Pino level (default `info`) |

## Vercel deployment

Set in Project → Settings → Environment Variables:

- **Production / Preview:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- **Audit (optional):** `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose to browser)

## Local example app

```bash
cd example
cp .env.local.example .env.local   # if present, or create manually
pnpm mcp:dev                       # from repo root: pnpm mcp:dev
```

Minimum `.env.local` at repo root (loaded by `loadLocalEnv`):

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your-local-anon-key
```

## Consumer-only variables

The package does **not** read script-only JWT env vars (e.g. `RECRUITING_MCP_ACCESS_TOKEN`). Keep those in consumer CLI code outside this library.

## Verification

With env set, `GET /api/config` returns `{ supabaseUrl, supabaseAnonKey }` without error.

## Common mistakes

- Putting service role key in `NEXT_PUBLIC_*` or browser-exposed config
- Missing anon key on Vercel — auth gate and OAuth UI fail at runtime
