---
title: Integrate MCP into your Vercel app
summary: End-to-end wiring of @medallo-dev/vercel-mcp in a consumer repository.
audience:
  - human
  - agent
when_to_read: Adding or changing MCP HTTP routes, tools, or OAuth UI in a consumer app.
prerequisites:
  - Completed install.md
  - Supabase project with Auth enabled
  - Vercel project linked to consumer repo
---

# Integrate your app

## Prerequisites

- `@medallo-dev/vercel-mcp` installed ([install.md](./install.md))
- Supabase project URL and anon key
- Vercel project with serverless functions enabled

## Steps

### 1. Install the package

See [install.md](./install.md).

### 2. Apply audit schema (optional)

Skip if you do not want `mcp.interaction_log` audit rows.

Apply [`schema/mcp.sql`](../schema/mcp.sql) to your Supabase project (SQL editor or migration). Set `SUPABASE_SERVICE_ROLE_KEY` on Vercel for audit writes.

### 3. Implement `VercelMcpServerDefinition`

Create `mcp/server.ts` (path is your choice):

```typescript
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { VercelMcpServerDefinition } from "@medallo-dev/vercel-mcp";
import { z } from "zod";

export const myMcpServer: VercelMcpServerDefinition = {
  name: "my-app",
  version: "1.0.0",
  instructions: "MCP tools for my application.",
  async listTools(_auth: AuthInfo | undefined) {
    return [
      {
        name: "ping_app",
        description: "Returns pong when MCP wiring works.",
        inputSchema: z.object({}),
      },
    ];
  },
  async callTool(name, _args, auth) {
    if (!auth) {
      return {
        content: [{ type: "text", text: "Authentication required." }],
        isError: true,
      };
    }
    if (name === "ping_app") {
      return { content: [{ type: "text", text: "pong" }] };
    }
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  },
};
```

Use your own Supabase client inside `callTool` for RLS-scoped data access.

### 4. Add `api/[transport].ts`

```typescript
import { createMcpMethodHandlers } from "@medallo-dev/vercel-mcp/transport";
import { myMcpServer } from "../mcp/server.ts";

const handlers = createMcpMethodHandlers({ server: myMcpServer });

export const POST = handlers.POST;
export const GET = handlers.GET;
export const DELETE = handlers.DELETE;
```

Reference: [`example/api/[transport].ts`](../example/api/[transport].ts).

### 5. Add OAuth routes

Copy and adapt from [`example/api/`](../example/api/):

| File | Purpose |
| --- | --- |
| `oauth-protected-resource.ts` | `/.well-known/oauth-protected-resource` |
| `config.ts` | Public Supabase URL + anon key for browser UI |
| `auth/callback.ts` | PKCE OAuth callback |

Import `resolveSupabaseAuthServerUrl` from `@medallo-dev/vercel-mcp/auth` in the protected-resource route.

### 6. Copy OAuth UI and `vercel.json`

Copy [`example/public/`](../example/public/) and [`example/vercel.json`](../example/vercel.json) rewrites:

- `/mcp` → `/api/mcp`
- `/health` → `/api/health`
- `/.well-known/oauth-protected-resource` → `/api/oauth-protected-resource`
- `/login`, `/oauth/consent` → static HTML

### 7. Set Vercel environment variables

See [environment.md](./environment.md). Minimum:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### 8. Deploy and smoke test

```bash
curl -s -o /dev/null -w "%{http_code}" https://YOUR_APP.vercel.app/health
curl -s -o /dev/null -w "%{http_code}" -X POST https://YOUR_APP.vercel.app/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'
```

Expect health `200` and MCP `401` without a bearer token.

### 9. Configure Cursor MCP

In Cursor MCP settings (or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "my-app": {
      "url": "https://YOUR_APP.vercel.app/mcp"
    }
  }
}
```

Cursor discovers OAuth via `WWW-Authenticate` + `resource_metadata` on 401. Complete sign-in through your deployed `/login` and consent flow.

### 10. Verification checklist

- [ ] `POST /mcp` without `Authorization` returns **401** with `WWW-Authenticate` header
- [ ] After OAuth, `tools/list` returns your tool names
- [ ] `tools/call` for `ping_app` returns text `pong`
- [ ] `GET /mcp` returns **405**

## Reference implementation

Compare your repo against [`example/`](../example/). Diff `api/`, `mcp/server.ts`, `public/`, and `vercel.json`.

## Common mistakes

- Duplicating framework code from recruiting-engine instead of importing this package
- Missing `vercel.json` rewrite for `/mcp`
- Forgetting `required: true` auth (default in `createMcpPostHandler`)
- Empty `tools/list` because `listTools` returns `[]` when auth is missing—handle in your server definition

## Next step

[environment.md](./environment.md) for full env var reference.
