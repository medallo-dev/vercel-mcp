# @medallo-dev/vercel-mcp

Internal library for hosting **Model Context Protocol (MCP)** servers on **Vercel** with **Supabase** JWT/OAuth authentication, structured logging, optional audit logging, and a generic JSON-RPC router.

Published privately to GitHub Packages as `@medallo-dev/vercel-mcp`.

## Documentation

| If you want to… | Read |
| --- | --- |
| Understand what this package does | [docs/getting-started.md](docs/getting-started.md) |
| Install from GitHub Packages | [docs/install.md](docs/install.md) |
| **Wire MCP into your Vercel app** | [docs/integrate-your-app.md](docs/integrate-your-app.md) |
| Look up exports and types | [docs/api-reference.md](docs/api-reference.md) |
| Configure environment variables | [docs/environment.md](docs/environment.md) |
| Understand Supabase OAuth / JWT | [docs/auth.md](docs/auth.md) |
| Fix errors | [docs/troubleshooting.md](docs/troubleshooting.md) |
| Publish a new version | [docs/publishing.md](docs/publishing.md) |
| Browse all guides | [docs/README.md](docs/README.md) |

**For AI agents:** read [AGENTS.md](AGENTS.md) and [docs/integrate-your-app.md](docs/integrate-your-app.md) before editing a consumer app.

## Quick install

```bash
# Configure .npmrc — see docs/install.md
pnpm add @medallo-dev/vercel-mcp@^1.0.0
```

## Development (this repo)

```bash
pnpm install
pnpm check          # lint + typecheck + test + build
pnpm mcp:dev        # vercel dev from example/
```

## License

UNLICENSED — medallo-dev internal use.
