---
title: Publishing releases
summary: Maintainer workflow for @medallo-dev/vercel-mcp on GitHub Packages.
audience:
  - human
  - agent
when_to_read: Cutting a new semver release of this package.
prerequisites:
  - Write access to medallo-dev/vercel-mcp
  - `pnpm check` passes on main
---

# Publishing

## Prerequisites

- GitHub org **medallo-dev** with Packages enabled
- CI green on the release commit

## Steps

### 1. Bump version

Update `version` in [`package.json`](../package.json) (semver).

### 2. Merge to `main`

Ensure [`pnpm check`](../package.json) passes locally:

```bash
pnpm check
```

### 3. Create GitHub Release

- Tag: `vX.Y.Z` (must match `package.json` version without `v`)
- Publish release (triggers [`.github/workflows/publish.yml`](../.github/workflows/publish.yml))

The workflow:

1. Verifies tag matches `package.json` version
2. Runs `pnpm check`
3. Runs `pnpm publish` to `https://npm.pkg.github.com`

### 4. Notify consumers

Document breaking changes in release notes. Consumers run:

```bash
pnpm add @medallo-dev/vercel-mcp@^X.Y.Z
```

## Verification

- Package appears under GitHub → medallo-dev → Packages
- Consumer `pnpm add` resolves the new version with valid `.npmrc`

## Common mistakes

- Tag `v1.0.0` but `package.json` says `1.0.1` — workflow fails version check
- Publishing without running tests locally first

## Consumer install reference

See [install.md](./install.md).
