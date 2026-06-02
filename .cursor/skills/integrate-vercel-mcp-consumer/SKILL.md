---
name: integrate-vercel-mcp-consumer
description: >-
  Wire a downstream repo to @medallo-dev/vercel-mcp: GitHub Packages install,
  VercelMcpServerDefinition, api routes, OAuth UI, vercel.json, and env vars.
  Use when integrating recruiting-engine, hermes-coo, or any consumer with vercel-mcp.
---

# Integrate vercel-mcp in a consumer repo

## Checklist

0. Read **[docs/integrate-your-app.md](../../docs/integrate-your-app.md)** and **[docs/install.md](../../docs/install.md)**.
1. Add **`@medallo-dev/vercel-mcp`** via GitHub Packages (`.npmrc` with `@medallo-dev:registry`).
2. Implement **`VercelMcpServerDefinition`** in the consumer (`listTools` / `callTool`; domain Supabase client is consumer-owned).
3. Add `api/[transport].ts` using `createMcpMethodHandlers` from `@medallo-dev/vercel-mcp/transport`.
4. Copy OAuth routes and `public/` from **[example/](../../example/)**; add **`vercel.json`** rewrites.
5. Set **`SUPABASE_URL`**, **`SUPABASE_ANON_KEY`** on Vercel; optional **`SUPABASE_SERVICE_ROLE_KEY`** + apply **[schema/mcp.sql](../../schema/mcp.sql)** for audit.
6. Verify: 401 without token, `tools/list` and `tools/call` with token (see integrate doc checklist).
7. **Delete** duplicated framework files after migration—import from the package.

Local dev override: `"@medallo-dev/vercel-mcp": "file:../vercel-mcp"` is OK for framework work only.
