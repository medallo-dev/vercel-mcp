---
name: maintain-vercel-mcp-framework
description: >-
  Maintain @medallo-dev/vercel-mcp framework code: src modules, exports, tests,
  Biome, or CI. Use when editing vercel-mcp src/.
---

# Maintain vercel-mcp framework

## Checklist

1. Read **[AGENTS.md](../../AGENTS.md)** boundaries — change belongs here, not in a consumer repo.
2. Read **[docs/api-reference.md](../../docs/api-reference.md)** for affected exports.
3. Add/update colocated **`*.test.ts`** next to changed modules.
4. Supabase: anon + `auth.getUser` in auth gate only; service-role **only** in `src/audit/`.
5. Do not add `supabase` CLI, `pg`, or domain schemas to runtime dependencies.
6. Run **`pnpm check`** before finishing.
7. Breaking API changes: semver bump, release notes, note consumer impact — **[docs/publishing.md](../../docs/publishing.md)**.

## Scope

Generic framework code only. Domain tools and app schemas stay in consumer repos. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
