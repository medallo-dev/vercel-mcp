---
title: Install @medallo-dev/vercel-mcp
summary: Install the private package from GitHub Packages (local and CI).
audience:
  - human
  - agent
when_to_read: Adding the dependency to a consumer repo or CI pipeline.
prerequisites:
  - GitHub org access to medallo-dev/vercel-mcp package
---

# Install

## Prerequisites

- Membership in the **medallo-dev** GitHub org with read access to the `vercel-mcp` package
- **pnpm** 10+ and Node **24+**

## Steps

### 1. Configure `.npmrc`

At your **consumer repo root** (or user `~/.npmrc`):

```ini
@medallo-dev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

For local development, export a GitHub personal access token (or `gh auth token`) with `read:packages`:

```bash
export GITHUB_TOKEN="$(gh auth token)"
```

See [`.npmrc.example`](../.npmrc.example) in this repo.

### 2. Add the dependency

```bash
pnpm add @medallo-dev/vercel-mcp@^0.0.0
```

### 3. GitHub Actions (consumer CI)

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 24
    registry-url: https://npm.pkg.github.com
    scope: "@medallo-dev"
- run: pnpm install --frozen-lockfile
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Use a dedicated `GH_PACKAGES_READ_TOKEN` if the default `GITHUB_TOKEN` lacks package read on cross-repo installs.

## Verification

```bash
pnpm why @medallo-dev/vercel-mcp
```

Typecheck should resolve imports:

```typescript
import { createMcpPostHandler } from "@medallo-dev/vercel-mcp/transport";
```

## Common mistakes

- Forgetting `@medallo-dev:registry` — install fails with 404 or unauthorized
- Using a token without `read:packages`
- Scope mismatch: package name must be `@medallo-dev/vercel-mcp`

## Next step

[integrate-your-app.md](./integrate-your-app.md)
