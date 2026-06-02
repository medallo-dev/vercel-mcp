import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";
import { resolveSupabaseAuthServerUrl } from "../../src/auth/supabase-mcp-auth.ts";
import { mcpVercelLogger } from "../../src/logging/logger-vercel.ts";

function oauthMetadataHandler() {
  return protectedResourceHandler({
    authServerUrls: [resolveSupabaseAuthServerUrl()],
  });
}

const optionsHandler = metadataCorsOptionsRequestHandler();

export function GET(req: Request): Response {
  mcpVercelLogger.debug(
    {
      event: "oauth.metadata",
      path: new URL(req.url).pathname,
      userAgent: req.headers.get("user-agent") ?? undefined,
    },
    "Serving OAuth protected resource metadata",
  );
  return oauthMetadataHandler()(req);
}

export function OPTIONS(req: Request): Response {
  mcpVercelLogger.debug(
    {
      event: "oauth.metadata.options",
      path: new URL(req.url).pathname,
    },
    "OAuth protected resource metadata preflight",
  );
  return optionsHandler();
}
