import {
  InsufficientScopeError,
  InvalidTokenError,
  ServerError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { getPublicOrigin } from "mcp-handler";
import { loadLocalEnv } from "../env/load-local-env.ts";
import {
  mcpVercelLogger,
  readMcpHttpHeaders,
  resolveMcpSessionId,
} from "../logging/logger-vercel.ts";
import { getJwtValidationClient } from "./jwt-validation.ts";

declare global {
  interface Request {
    auth?: AuthInfo;
  }
}

export function resolveSupabaseAuthServerUrl(): string {
  loadLocalEnv();
  const explicit = process.env.SUPABASE_AUTH_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/u, "");
  }
  const base = (process.env.SUPABASE_URL ?? process.env.API_URL)?.trim();
  if (!base) {
    throw new Error(
      "Set SUPABASE_URL or SUPABASE_AUTH_URL for MCP OAuth metadata and JWT validation.",
    );
  }
  return `${base.replace(/\/$/u, "")}/auth/v1`;
}

export type VerifySupabaseMcpTokenOptions = {
  defaultScopes?: string[];
};

export async function verifySupabaseMcpToken(
  req: Request,
  bearerToken?: string,
  { defaultScopes = ["mcp"] }: VerifySupabaseMcpTokenOptions = {},
): Promise<AuthInfo | undefined> {
  const path = new URL(req.url).pathname;
  const sessionId = resolveMcpSessionId({
    requestSessionId: readMcpHttpHeaders(req.headers).mcpSessionId,
  });

  let jwt = bearerToken?.trim();
  if (!jwt) {
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      jwt = authHeader.substring("Bearer ".length).trim();
    }
  }

  if (!jwt) {
    mcpVercelLogger.debug(
      { event: "auth.missing_token", path, sessionId },
      "MCP request without bearer token",
    );
    return undefined;
  }

  try {
    const client = getJwtValidationClient();
    const { data, error } = await client.auth.getUser(jwt);
    if (error || !data?.user?.id) {
      mcpVercelLogger.warn(
        {
          event: "auth.rejected",
          path,
          sessionId,
          reason: error?.message ?? "missing user id",
        },
        "Supabase rejected MCP bearer token",
      );
      return undefined;
    }

    mcpVercelLogger.debug(
      { event: "auth.verified", path, userId: data.user.id, sessionId },
      "MCP bearer token verified",
    );
    return {
      token: jwt,
      scopes: defaultScopes,
      clientId: data.user.id,
      extra: {
        userId: data.user.id,
        ...(data.user.email !== undefined &&
        data.user.email !== null &&
        typeof data.user.email === "string" &&
        data.user.email.length > 0
          ? { email: data.user.email }
          : {}),
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown auth error";
    mcpVercelLogger.error(
      { event: "auth.unavailable", path, sessionId, err: error },
      `Supabase Auth unavailable during MCP JWT validation: ${message}`,
    );
    return undefined;
  }
}

export type WithSupabaseMcpAuthOptions = {
  required?: boolean;
  resourceMetadataPath?: string;
  requiredScopes?: string[];
  resourceUrl?: string;
  defaultScopes?: string[];
};

export function withSupabaseMcpAuth(
  handler: (req: Request) => Response | Promise<Response>,
  {
    required = false,
    resourceMetadataPath = "/.well-known/oauth-protected-resource",
    requiredScopes,
    resourceUrl: explicitResourceUrl,
    defaultScopes,
  }: WithSupabaseMcpAuthOptions = {},
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const origin = (explicitResourceUrl ?? getPublicOrigin(req)).replace(
      /\/$/u,
      "",
    );
    const resourceMetadataUrl = `${origin}${resourceMetadataPath}`;

    const authHeader =
      req.headers.get("Authorization") ?? req.headers.get("authorization");
    const [type, token] = authHeader?.split(/\s+/u, 2) ?? [];
    const bearerToken = type?.toLowerCase() === "bearer" ? token : undefined;

    let authInfo: AuthInfo | undefined;
    try {
      authInfo = await verifySupabaseMcpToken(req, bearerToken, {
        defaultScopes,
      });
    } catch (error) {
      console.error("Unexpected error authenticating bearer token:", error);
      const publicError = new InvalidTokenError("Invalid token");
      return new Response(JSON.stringify(publicError.toResponseObject()), {
        status: 401,
        headers: {
          "WWW-Authenticate": `Bearer error="${publicError.errorCode}", error_description="${publicError.message}", resource_metadata="${resourceMetadataUrl}"`,
          "Content-Type": "application/json",
        },
      });
    }

    try {
      if (required && !authInfo) {
        throw new InvalidTokenError("No authorization provided");
      }
      if (!authInfo) {
        return handler(req);
      }
      if (requiredScopes?.length && authInfo) {
        const hasAllScopes = requiredScopes.every((scope) =>
          authInfo.scopes.includes(scope),
        );
        if (!hasAllScopes) {
          throw new InsufficientScopeError("Insufficient scope");
        }
      }
      if (
        authInfo.expiresAt !== undefined &&
        authInfo.expiresAt < Date.now() / 1000
      ) {
        throw new InvalidTokenError("Token has expired");
      }
      req.auth = authInfo;
      return handler(req);
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        return new Response(JSON.stringify(error.toResponseObject()), {
          status: 401,
          headers: {
            "WWW-Authenticate": `Bearer error="${error.errorCode}", error_description="${error.message}", resource_metadata="${resourceMetadataUrl}"`,
            "Content-Type": "application/json",
          },
        });
      }
      if (error instanceof InsufficientScopeError) {
        return new Response(JSON.stringify(error.toResponseObject()), {
          status: 403,
          headers: {
            "WWW-Authenticate": `Bearer error="${error.errorCode}", error_description="${error.message}", resource_metadata="${resourceMetadataUrl}"`,
            "Content-Type": "application/json",
          },
        });
      }
      if (error instanceof ServerError) {
        return new Response(JSON.stringify(error.toResponseObject()), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      console.error("Unexpected error authenticating bearer token:", error);
      const serverError = new ServerError("Internal Server Error");
      return new Response(JSON.stringify(serverError.toResponseObject()), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}
