import {
  type WithSupabaseMcpAuthOptions,
  withSupabaseMcpAuth,
} from "../auth/supabase-mcp-auth.ts";
import type { VercelMcpServerDefinition } from "../jsonrpc/handle-json-rpc.ts";
import { createJsonRpcHandler } from "../jsonrpc/handle-json-rpc.ts";
import { withMcpRequestLogging } from "../logging/logger-vercel.ts";

export type CreateMcpPostHandlerOptions = {
  server: VercelMcpServerDefinition;
  auth?: WithSupabaseMcpAuthOptions;
};

function resolveTransport(req: Request): string | undefined {
  const path = new URL(req.url).pathname.replace(/\/+$/u, "") || "/";
  const apiMatch = path.match(/\/api\/([^/]+)$/u);
  if (apiMatch) {
    return apiMatch[1];
  }
  if (path === "/mcp") {
    return "mcp";
  }
  return undefined;
}

function methodNotAllowedResponse(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method Not Allowed" },
      id: null,
    }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "POST",
      },
    },
  );
}

export function createMcpPostHandler({
  server,
  auth,
}: CreateMcpPostHandlerOptions): (request: Request) => Promise<Response> {
  const handleJsonRpc = createJsonRpcHandler(server);

  async function handleMcpJsonRpc(req: Request): Promise<Response> {
    if (resolveTransport(req) !== "mcp") {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Not Found" },
          id: null,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" },
          id: null,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const outcome = await handleJsonRpc(body, req.auth);
    if (outcome.kind === "no_content") {
      return new Response(null, { status: outcome.status });
    }
    return new Response(JSON.stringify(outcome.body), {
      status: outcome.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authOptions: WithSupabaseMcpAuthOptions = {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
    ...auth,
  };

  return withMcpRequestLogging(
    withSupabaseMcpAuth((req) => handleMcpJsonRpc(req), authOptions),
  );
}

export function createMcpMethodHandlers(options: CreateMcpPostHandlerOptions): {
  POST: (request: Request) => Promise<Response>;
  GET: () => Response;
  DELETE: () => Response;
} {
  const postHandler = createMcpPostHandler(options);
  return {
    POST: postHandler,
    GET: methodNotAllowedResponse,
    DELETE: methodNotAllowedResponse,
  };
}
