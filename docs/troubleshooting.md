---
title: Troubleshooting
summary: Symptom → cause → fix for common MCP deployment issues.
audience:
  - human
  - agent
when_to_read: Debugging 401, npm install, empty tools/list, OAuth, or audit warnings.
prerequisites: []
---

# Troubleshooting

## HTTP / MCP

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `401` on every `POST /mcp` | Missing or expired bearer token | Complete OAuth; send `Authorization: Bearer <jwt>` |
| `401` but token looks valid | Wrong Supabase project URL/key on Vercel | Match `SUPABASE_URL` / `SUPABASE_ANON_KEY` to token issuer |
| No `WWW-Authenticate` header | Auth middleware bypassed | Use `createMcpPostHandler`; do not skip `withSupabaseMcpAuth` |
| Empty `tools/list` | `listTools` returns `[]` without auth | Return tools only when `auth` present, or by design |
| `404` on `/mcp` | Missing rewrite | Add `vercel.json` rewrite to `/api/mcp` |
| `405` on `GET /mcp` | Expected | MCP endpoint is POST-only |

## npm / GitHub Packages

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `404` on `pnpm add @medallo-dev/vercel-mcp` | Missing registry config | Add `@medallo-dev:registry=https://npm.pkg.github.com` to `.npmrc` |
| `401` / `403` on install | Token lacks `read:packages` | Use `gh auth token` or PAT with package read |
| CI install fails | `NODE_AUTH_TOKEN` not set | Configure `setup-node` with registry URL + token |

## OAuth UI

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `/api/config` 500 | Missing Supabase env | Set `SUPABASE_URL` + `SUPABASE_ANON_KEY` |
| Redirect loop on consent | Session not established | Check `/api/auth/callback` and cookie domain |
| OAuth client mismatch | Redirect URI not allowlisted | Add Vercel URL in Supabase Auth redirect URLs |

## Audit

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Log: `audit.disabled` | No service role key | Set `SUPABASE_SERVICE_ROLE_KEY` or skip audit |
| Audit insert fails | `schema/mcp.sql` not applied | Run migration on Supabase project |

## Still stuck

Diff your consumer repo against [`example/`](../example/):

- `api/[transport].ts`
- `api/oauth-protected-resource.ts`
- `api/config.ts`
- `api/auth/callback.ts`
- `vercel.json`
- `public/`
