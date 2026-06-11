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

## Automated flow

Publishing is automated by [`.github/workflows/publish.yml`](../.github/workflows/publish.yml) on every push to `main`. Version bumps are managed with [changesets](https://github.com/changesets/changesets); artifacts are pushed to the private **medallo-dev** GitHub Packages npm registry.

Because `main` is protected, version bumps cannot be pushed directly by Actions. The workflow uses [changesets/action](https://github.com/changesets/action) to open a **"chore: version packages"** PR instead; publishing happens after that PR is merged.

## Steps

### 1. Add a changeset

In your feature PR, record the semver bump:

```bash
pnpm changeset
```

Select `@medallo-dev/vercel-mcp` and choose `patch`, `minor`, or `major`. Commit the generated `.changeset/*.md` file with your changes.

### 2. Merge the PR to `main`

CI ([`ci.yml`](../.github/workflows/ci.yml)) runs `pnpm check`. The publish workflow ([`publish.yml`](../.github/workflows/publish.yml)) runs [changesets/action](https://github.com/changesets/action):

- If pending changesets exist → opens a PR titled **"chore: version packages"** that bumps `package.json` version and updates `CHANGELOG.md`.
- If no pending changesets exist but versions were already bumped → runs `pnpm release` to build and publish.

### 3. Merge the version PR

After the **"chore: version packages"** PR merges, the publish workflow runs again and executes:

1. `pnpm check`
2. `pnpm release` (`pnpm build` + `changeset publish` to `https://npm.pkg.github.com`)

### 4. Notify consumers

Document breaking changes in the version PR / release notes. Consumers run:

```bash
pnpm add @medallo-dev/vercel-mcp@^X.Y.Z
```

## Local publish (maintainers only)

Requires `NODE_AUTH_TOKEN` with `write:packages`:

```bash
pnpm changeset version   # optional: bump versions locally first
pnpm release             # build + publish via scripts/publish-packages.mjs
```

## Verification

- [Actions → publish.yml](https://github.com/medallo-dev/vercel-mcp/actions/workflows/publish.yml): latest run on `main` should succeed
- Package appears under GitHub → medallo-dev → Packages
- Consumer `pnpm add` resolves the new version with valid `.npmrc`

## Common mistakes

- Merging to `main` without a changeset when you intended to release — no version bump or publish occurs
- Publishing without running `pnpm check` locally first
- Using a token without `write:packages` for local publish

## Consumer install reference

See [install.md](./install.md).
