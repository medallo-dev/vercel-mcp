import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadLocalEnv, resolveSupabaseUrl } from "../env/load-local-env.ts";
import {
  currentMcpRequestContext,
  currentMcpSessionId,
  mcpVercelLogger,
} from "../logging/logger-vercel.ts";
import type { Json, McpDatabase } from "../types/mcp-database.ts";

type JsonRpcAuditEnvelope =
  | { jsonrpc: "2.0"; result: unknown; id: string | number | null }
  | {
      jsonrpc: "2.0";
      error: { code: number; message: string };
      id: string | number | null;
    };

export type BeginMcpInteractionAuditInput = {
  body: unknown;
  authInfo: AuthInfo | undefined;
  logCtx: {
    jsonrpcMethod?: string;
    jsonrpcId?: string | number | null;
    userId?: string;
  };
};

export type FinalizeMcpInteractionAuditInput = {
  startedAt: number;
  httpStatus: number;
  jsonRpcEnvelope: JsonRpcAuditEnvelope | null;
  outcomeStatus: "success" | "error";
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isUuidLike(value: string): boolean {
  return UUID_REGEX.test(value);
}

function resolveServiceRoleKey(): string | undefined {
  loadLocalEnv();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  return key?.trim() || undefined;
}

let missingServiceRoleWarned = false;
let auditClientSingleton: SupabaseClient<McpDatabase, "mcp"> | null | undefined;

function getMcpAuditClient(): SupabaseClient<McpDatabase, "mcp"> | null {
  const key = resolveServiceRoleKey();
  if (!key) {
    if (!missingServiceRoleWarned) {
      missingServiceRoleWarned = true;
      mcpVercelLogger.warn(
        {
          event: "audit.disabled",
          reason: "missing SUPABASE_SERVICE_ROLE_KEY",
        },
        "MCP interaction audit inserts disabled until service-role key is set",
      );
    }
    return null;
  }
  if (auditClientSingleton === undefined) {
    auditClientSingleton = createClient<McpDatabase, "mcp">(
      resolveSupabaseUrl(),
      key,
      {
        db: { schema: "mcp" },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    );
  }
  return auditClientSingleton;
}

export function resetMcpAuditClientForTests(): void {
  auditClientSingleton = undefined;
  missingServiceRoleWarned = false;
}

function coerceJsonRpcId(value: unknown): Json | null {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (value === null) {
    return null;
  }
  return null;
}

function extractJsonRpcMessage(
  body: unknown,
): Record<string, unknown> | undefined {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }
  return body as Record<string, unknown>;
}

function extractRpcParameters(body: unknown): Json | null {
  const msg = extractJsonRpcMessage(body);
  const params = msg?.params;
  if (params === undefined) {
    return null;
  }
  try {
    return structuredClone(params) as Json;
  } catch {
    return JSON.parse(JSON.stringify(params)) as Json;
  }
}

function extractToolName(body: unknown, method?: string): string | null {
  if (method !== "tools/call") {
    return null;
  }
  const msg = extractJsonRpcMessage(body);
  const params = msg?.params;
  if (params === null || typeof params !== "object" || Array.isArray(params)) {
    return null;
  }
  const name = (params as Record<string, unknown>).name;
  return typeof name === "string" ? name : null;
}

function callerFromAuth(authInfo: AuthInfo | undefined): string {
  if (!authInfo) {
    return "anonymous";
  }
  const rawExtra = authInfo.extra;
  const email =
    rawExtra !== null &&
    typeof rawExtra === "object" &&
    typeof (rawExtra as { email?: unknown }).email === "string"
      ? ((rawExtra as { email?: string }).email ?? "").trim()
      : "";
  if (email) {
    return email;
  }
  return authInfo.clientId ?? "anonymous";
}

function resolvedUserId(logUserId?: string): string | null {
  if (!logUserId || !isUuidLike(logUserId)) {
    return null;
  }
  return logUserId;
}

function resolveAuditRequestUuid(): string {
  const httpCtx = currentMcpRequestContext();
  const requestIdRaw = httpCtx?.requestId;
  try {
    return typeof requestIdRaw === "string" && isUuidLike(requestIdRaw)
      ? requestIdRaw
      : crypto.randomUUID();
  } catch {
    return crypto.randomUUID();
  }
}

function resolveJsonRpcMethod(body: unknown, logCtxMethod?: string): string {
  if (logCtxMethod) {
    return logCtxMethod;
  }
  const msg = extractJsonRpcMessage(body);
  return typeof msg?.method === "string" ? String(msg.method) : "(unknown)";
}

function auditResponsePayload(
  jsonRpcEnvelope: JsonRpcAuditEnvelope | null,
  httpStatus: number,
): Json {
  if (jsonRpcEnvelope === null) {
    return {
      jsonrpc: "2.0",
      kind: "no_content",
      httpStatus,
      id: null,
    };
  }
  try {
    return structuredClone(jsonRpcEnvelope) as Json;
  } catch {
    return JSON.parse(JSON.stringify(jsonRpcEnvelope)) as Json;
  }
}

const pendingResponseEnvelope: Json = {
  audit: "pending",
  jsonrpc: "2.0",
  id: null,
};

export async function beginMcpInteractionAudit(
  input: BeginMcpInteractionAuditInput,
): Promise<void> {
  try {
    const client = getMcpAuditClient();
    if (!client) {
      return;
    }

    const requestUuid = resolveAuditRequestUuid();
    const method = resolveJsonRpcMethod(input.body, input.logCtx.jsonrpcMethod);

    const row: McpDatabase["mcp"]["Tables"]["interaction_log"]["Insert"] = {
      request_id: requestUuid,
      user_id: resolvedUserId(input.logCtx.userId),
      caller: callerFromAuth(input.authInfo),
      jsonrpc_id: coerceJsonRpcId(
        extractJsonRpcMessage(input.body)?.id ?? input.logCtx.jsonrpcId,
      ),
      jsonrpc_method: method,
      tool_name: extractToolName(input.body, method),
      parameters: extractRpcParameters(input.body),
      response: pendingResponseEnvelope,
      outcome: "pending",
      http_status: 0,
      duration_ms: 0,
      session_id: currentMcpSessionId() ?? null,
      calling_agent: currentMcpRequestContext()?.userAgent ?? null,
      mcp_protocol_version:
        currentMcpRequestContext()?.mcpProtocolVersion ?? null,
    };

    const { error } = await client.from("interaction_log").insert(row);
    if (error) {
      mcpVercelLogger.warn(
        {
          event: "audit.begin_failed",
          requestId: requestUuid,
          errMsg: error.message,
        },
        "Failed to persist pending MCP interaction audit row",
      );
    }
  } catch (error) {
    mcpVercelLogger.warn(
      {
        event: "audit.begin_failed",
        err: error instanceof Error ? error.message : error,
      },
      "Unexpected error while beginning MCP interaction audit row",
    );
  }
}

export async function finalizeMcpInteractionAudit(
  input: FinalizeMcpInteractionAuditInput,
): Promise<void> {
  try {
    const client = getMcpAuditClient();
    if (!client) {
      return;
    }

    const requestUuid = resolveAuditRequestUuid();
    const patch: McpDatabase["mcp"]["Tables"]["interaction_log"]["Update"] = {
      response: auditResponsePayload(input.jsonRpcEnvelope, input.httpStatus),
      outcome: input.outcomeStatus,
      http_status: input.httpStatus,
      duration_ms: Math.max(0, Math.trunc(Date.now() - input.startedAt)),
    };

    const { error } = await client
      .from("interaction_log")
      .update(patch)
      .eq("request_id", requestUuid);
    if (error) {
      mcpVercelLogger.warn(
        {
          event: "audit.finalize_failed",
          requestId: requestUuid,
          errMsg: error.message,
        },
        "Failed to finalize MCP interaction audit row",
      );
    }
  } catch (error) {
    mcpVercelLogger.warn(
      {
        event: "audit.finalize_failed",
        err: error instanceof Error ? error.message : error,
      },
      "Unexpected error while finalizing MCP interaction audit row",
    );
  }
}
