---
name: update-mcp-audit-schema
description: >-
  Change mcp.interaction_log schema or audit types in vercel-mcp: schema/mcp.sql,
  McpDatabase types, interaction-log.ts. Use when modifying MCP audit logging.
---

# Update MCP audit schema

## Checklist

1. Edit **[schema/mcp.sql](../../schema/mcp.sql)** (source of truth; service_role only, FORCE RLS).
2. Update **[src/types/mcp-database.ts](../../src/types/mcp-database.ts)** to match columns.
3. Adjust **[src/audit/interaction-log.ts](../../src/audit/interaction-log.ts)** and **[src/audit/interaction-log.test.ts](../../src/audit/interaction-log.test.ts)**.
4. Document in **[docs/environment.md](../../docs/environment.md)** if new env vars are needed.
5. Consumers must apply SQL to **their** Supabase project (this repo does not run migrations in CI).
6. Run **`pnpm check`**.
