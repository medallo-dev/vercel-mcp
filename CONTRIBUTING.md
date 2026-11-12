# Contributing to vercel-mcp

Thanks for your interest in improving `@medallo-dev/vercel-mcp`! This document explains how to propose changes and what we expect from contributions.

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Scope

This package is a small, generic framework: Supabase JWT auth gate, OAuth metadata, structured logging, a JSON-RPC router, a Vercel transport factory, and an optional audit log. Before starting larger work, please check that it fits:

- **In scope:** bug fixes, security hardening, MCP spec compatibility, better errors/logging, docs, tests, and generic features useful to any Vercel + Supabase MCP server.
- **Out of scope:** domain-specific tools or schemas, new runtime dependencies on `pg` or the Supabase CLI, and app-specific generated `Database` types. These belong in your own consumer app.

For anything beyond a small fix, please [open an issue](https://github.com/medallo-dev/vercel-mcp/issues/new/choose) first so we can agree on the approach before you invest time.

## Reporting bugs and requesting features

- **Bugs:** use the bug report template. Include the package version, Node version, a minimal reproduction, and the actual vs. expected behaviour. Redact tokens and keys from logs.
- **Features:** use the feature request template and describe the problem you are solving, not only the solution.
- **Security vulnerabilities:** do **not** open a public issue. Follow [SECURITY.md](SECURITY.md).

## Development setup

Requirements: Node **24+** and pnpm **10+** (`corepack enable` picks up the pinned version).

```bash
git clone https://github.com/medallo-dev/vercel-mcp.git
cd vercel-mcp
pnpm install
pnpm check        # lint + typecheck + test + build
```

Running the example app against a local Supabase (optional):

```bash
cp .env.local.example .env.local   # fill in your local Supabase values
pnpm mcp:dev
```

See [docs/environment.md](docs/environment.md) for every variable. Tests never talk to a live Supabase; auth tests mock the client.

## Making a change

1. Fork the repo and create a branch from `main`.
2. Make your change. Keep PRs focused — one logical change per PR.
3. Add or update colocated tests (`src/**/*.test.ts`) for any behaviour change.
4. Update docs in [`docs/`](docs/) when you change public API, env vars, or behaviour. [docs/api-reference.md](docs/api-reference.md) covers the exported surface.
5. Run `pnpm fmt` and then `pnpm check`. CI runs the same command.
6. Add a changeset (see below) if the change affects the published package.
7. Open a pull request and fill out the template.

### Code style

- TypeScript, ESM, strict mode. Formatting and linting are enforced by [Biome](https://biomejs.dev/) (`pnpm fmt`).
- Keep the service-role Supabase key confined to `src/audit/`. The auth gate uses only the anon key and `auth.getUser`.
- Prefer small, dependency-free code. New runtime dependencies need a clear justification in the PR.

### Changesets and versioning

We use [changesets](https://github.com/changesets/changesets) and follow [semver](https://semver.org/). For any change that affects the published package:

```bash
pnpm changeset
```

Pick `patch` (fixes), `minor` (backwards-compatible features), or `major` (breaking changes), and write a one-line summary aimed at users. Commit the generated `.changeset/*.md` file. Docs-only or CI-only PRs do not need a changeset.

Breaking changes to `VercelMcpServerDefinition`, `createJsonRpcHandler`, `createMcpPostHandler`, `withSupabaseMcpAuth`, or any subpath export require a `major` changeset with migration notes.

Releases are cut by maintainers; see [docs/publishing.md](docs/publishing.md).

### Commit messages

We recommend [Conventional Commits](https://www.conventionalcommits.org/) (`fix:`, `feat:`, `docs:`, `chore:` …). PRs are squash-merged, so the PR title becomes the commit message.

## Review process

- A maintainer will review your PR. We aim to respond within a week; ping the PR if it has been quiet longer.
- CI must be green and review comments resolved before merge.
- Maintainers may push small fixups to your branch or ask you to split large PRs.

## Licensing of contributions

This project is licensed under the [MIT License](LICENSE). By submitting a contribution, you agree that it is licensed under the same terms (inbound = outbound) and that you have the right to submit it.
