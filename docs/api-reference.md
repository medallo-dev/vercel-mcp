---
title: API reference
summary: Exports, types, and handler options for @medallo-dev/vercel-mcp.
audience:
  - human
  - agent
when_to_read: Looking up function signatures or subpath imports while implementing or maintaining the package.
prerequisites: []
---

# API reference

## Subpath exports

| Import path | Contents |
| --- | --- |
| `@medallo-dev/vercel-mcp` | Main re-exports |
| `@medallo-dev/vercel-mcp/auth` | JWT gate, `runWithMcpJwt`, `resolveSupabaseAuthServerUrl` |
| `@medallo-dev/vercel-mcp/logging` | Pino logger, `withMcpRequestLogging` |
| `@medallo-dev/vercel-mcp/audit` | `beginMcpInteractionAudit`, `finalizeMcpInteractionAudit` |
| `@medallo-dev/vercel-mcp/jsonrpc` | `createJsonRpcHandler`, types |
| `@medallo-dev/vercel-mcp/transport` | `createMcpPostHandler`, `createMcpMethodHandlers` |
| `@medallo-dev/vercel-mcp/env` | `loadLocalEnv`, `readPublicSupabaseConfig` |

## `VercelMcpServerDefinition`

```typescript
type VercelMcpServerDefinition = {
  name: string;
  version: string;
  instructions?: string;
  listTools(auth: AuthInfo | undefined): Promise<VercelMcpToolDefinition[]>;
  callTool(
    name: string,
    args: unknown,
    auth: AuthInfo | undefined,
  ): Promise<McpToolCallResult>;
};
```

`McpToolCallResult`:

```typescript
{ content: Array<{ type: "text"; text: string }>; isError?: boolean }
```

Tool `inputSchema` should be a Zod object shape (or compatible MCP Zod raw shape).

## `createMcpPostHandler` / `createMcpMethodHandlers`

```typescript
createMcpPostHandler({
  server: myMcpServer,
  auth?: {
    required?: boolean;              // default true via transport
    resourceMetadataPath?: string;   // default /.well-known/oauth-protected-resource
    requiredScopes?: string[];
    resourceUrl?: string;
    defaultScopes?: string[];        // default ["mcp"]
  },
});
```

`createMcpMethodHandlers` returns `{ POST, GET, DELETE }` for Vercel route modules.

## `createJsonRpcHandler`

Lower-level: `(body, authInfo) => HandleJsonRpcOutcome`. Used internally by transport; call directly only if you need custom HTTP parsing.

## JSON-RPC methods implemented

| Method | Behavior |
| --- | --- |
| `initialize` | Negotiates protocol version; returns `serverInfo`, `instructions` |
| `tools/list` | Calls `server.listTools` |
| `tools/call` | Validates args with Zod; calls `server.callTool` |
| `ping` | Empty result |
| `notifications/initialized` | HTTP 204 |
| Batch arrays | Rejected with `-32600` |

## Auth helpers

- `withSupabaseMcpAuth(handler, options)` — middleware; sets `req.auth`
- `verifySupabaseMcpToken(req, bearerToken?, { defaultScopes })`
- `runWithMcpJwt({ jwt, userId }, fn)` — ALS for tool handlers
- `getJwtValidationClient()` — anon Supabase client for `auth.getUser`

## Audit

- `beginMcpInteractionAudit` / `finalizeMcpInteractionAudit` — no-op when `SUPABASE_SERVICE_ROLE_KEY` unset

Source: [`src/`](../src/)
