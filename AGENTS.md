# AGENTS.md

Guidance for AI agents working in **vercel-mcp** — an open-source library for Vercel-hosted MCP + Supabase auth (`@medallo-dev/vercel-mcp`).

## Overview

This repo is **not** a deployable product. It provides:

- Supabase JWT gate (`withSupabaseMcpAuth`)
- Generic JSON-RPC (`createJsonRpcHandler`)
- Vercel transport factory (`createMcpPostHandler`)
- Optional `mcp.interaction_log` audit
- Reference app under `example/`

Domain tools and app schemas belong in **consumer repos**, not here.

## Commands

```bash
pnpm install
pnpm lint
pnpm fmt
pnpm typecheck
pnpm test
pnpm build
pnpm check          # run after every change
pnpm changeset      # record a semver bump for the current PR (required before publishing)
pnpm release        # build and publish to GitHub Packages
pnpm mcp:dev        # example app on Vercel dev
```

## Layout

```
src/auth/           Supabase JWT validation + middleware
src/logging/        Pino + request/session ALS
src/audit/          interaction_log (service_role, mcp schema)
src/jsonrpc/        Generic JSON-RPC router
src/transport/      createMcpPostHandler for Vercel api/
src/env/            loadLocalEnv, public Supabase config
src/types/          Hand-maintained McpDatabase types
example/            Reference consumer wiring (not published)
schema/mcp.sql      Optional audit migration for consumers
docs/               Human + agent documentation (shipped in npm tarball)
```

## Boundaries

**In this package:** auth gate (`getUser`), logging, generic JSON-RPC, optional audit.

**Never in this package:** domain tools, app-specific schemas, `pg`, Supabase CLI as runtime dep, full generated `Database` types.

## Documentation map

| If you are… | Read first |
| --- | --- |
| Wiring a **consumer** repo | [docs/integrate-your-app.md](docs/integrate-your-app.md), [docs/environment.md](docs/environment.md) |
| Changing **this** repo `src/` | [docs/api-reference.md](docs/api-reference.md) |
| Installing the package | [docs/install.md](docs/install.md) |
| Publishing a release | [docs/publishing.md](docs/publishing.md) |
| Debugging deploy issues | [docs/troubleshooting.md](docs/troubleshooting.md) |

Do not duplicate long guides in this file — link to `docs/`.

## Mandatory reading

- **Consumer repo work:** [docs/integrate-your-app.md](docs/integrate-your-app.md) + [docs/environment.md](docs/environment.md)
- **Framework changes:** [docs/api-reference.md](docs/api-reference.md) + skill `maintain-vercel-mcp-framework`

## Public API (semver)

Key types: `VercelMcpServerDefinition`, `createJsonRpcHandler`, `createMcpPostHandler`, `withSupabaseMcpAuth`.

Breaking changes require semver major bump and release notes. See [docs/publishing.md](docs/publishing.md).

## Testing

- Colocated `src/**/*.test.ts`
- Mock Supabase in auth tests; stub `VercelMcpServerDefinition` for JSON-RPC tests
- No live Supabase in CI

## Releases

Add a changeset in your PR (`pnpm changeset`) → merge to `main` → merge the **"chore: version packages"** PR → [`publish.yml`](.github/workflows/publish.yml) pushes to GitHub Packages. See [docs/publishing.md](docs/publishing.md).

## Cursor Configuration

Project skills under `.cursor/skills/`:

| Skill | When to use |
| --- | --- |
| [use-vercel-mcp](.cursor/skills/use-vercel-mcp/SKILL.md) | Consumer app integration (start here) |
| [integrate-vercel-mcp-consumer](.cursor/skills/integrate-vercel-mcp-consumer/SKILL.md) | Full consumer wiring checklist |
| [maintain-vercel-mcp-framework](.cursor/skills/maintain-vercel-mcp-framework/SKILL.md) | Editing `src/`, deps, CI |
| [update-mcp-audit-schema](.cursor/skills/update-mcp-audit-schema/SKILL.md) | `schema/mcp.sql` or audit types |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for scope, workflow, and changeset rules. Security reports go through [SECURITY.md](SECURITY.md).

## Consumer integration

Downstream repos add `@medallo-dev/vercel-mcp` from GitHub Packages, implement `VercelMcpServerDefinition`, and copy patterns from `example/`. See skill `integrate-vercel-mcp-consumer`.
