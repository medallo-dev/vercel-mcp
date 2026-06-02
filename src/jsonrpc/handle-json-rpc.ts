import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  getParseErrorMessage,
  normalizeObjectSchema,
  safeParseAsync,
  type ZodRawShapeCompat,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";
import {
  DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "@modelcontextprotocol/sdk/types.js";
import {
  beginMcpInteractionAudit,
  finalizeMcpInteractionAudit,
} from "../audit/interaction-log.ts";
import {
  currentMcpRequestContext,
  currentMcpSessionId,
  mcpVercelLogger,
  summarizeJsonRpcBody,
  summarizeJsonRpcResult,
} from "../logging/logger-vercel.ts";

export type McpToolCallResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export type VercelMcpToolDefinition = {
  name: string;
  title?: string;
  description?: string;
  inputSchema: ZodRawShapeCompat | unknown;
  annotations?: Record<string, unknown>;
};

export type VercelMcpServerDefinition = {
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

export type JsonRpcEnvelope =
  | { jsonrpc: "2.0"; result: unknown; id: string | number | null }
  | {
      jsonrpc: "2.0";
      error: { code: number; message: string };
      id: string | number | null;
    };

export type HandleJsonRpcOutcome =
  | { kind: "json"; status: number; body: JsonRpcEnvelope }
  | { kind: "no_content"; status: 204 };

function negotiateProtocolVersion(clientVersion: unknown): string {
  if (
    typeof clientVersion === "string" &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(clientVersion)
  ) {
    return clientVersion;
  }
  return DEFAULT_NEGOTIATED_PROTOCOL_VERSION;
}

export async function listToolsForMcpList(
  server: VercelMcpServerDefinition,
  authInfo: AuthInfo | undefined,
): Promise<
  Array<{
    name: string;
    title?: string;
    description?: string;
    inputSchema: Record<string, unknown>;
    annotations?: Record<string, unknown>;
  }>
> {
  const tools = await server.listTools(authInfo);
  return tools.map((tool) => {
    const obj = normalizeObjectSchema(tool.inputSchema as ZodRawShapeCompat);
    const inputSchema = obj
      ? toJsonSchemaCompat(obj, { strictUnions: true, pipeStrategy: "input" })
      : { type: "object", properties: {} };
    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: inputSchema as Record<string, unknown>,
      annotations: tool.annotations,
    };
  });
}

export async function validateToolArgs(
  tool: VercelMcpToolDefinition,
  args: unknown,
): Promise<
  { ok: true; data: Record<string, unknown> } | { ok: false; message: string }
> {
  const inputObj = normalizeObjectSchema(tool.inputSchema as ZodRawShapeCompat);
  if (!inputObj) {
    return { ok: false, message: "Invalid tool input schema" };
  }
  const parseResult = await safeParseAsync(inputObj, args);
  if (!parseResult.success) {
    const error = "error" in parseResult ? parseResult.error : "Unknown error";
    return { ok: false, message: getParseErrorMessage(error) };
  }
  return { ok: true, data: parseResult.data as Record<string, unknown> };
}

type JsonRpcLogContext = {
  startedAt: number;
  jsonrpcMethod?: string;
  jsonrpcId?: string | number | null;
  userId?: string;
};

function createJsonRpcLogContext(
  body: unknown,
  authInfo: AuthInfo | undefined,
): JsonRpcLogContext {
  const summary = summarizeJsonRpcBody(body);
  return {
    startedAt: Date.now(),
    jsonrpcMethod: summary?.jsonrpcMethod,
    jsonrpcId: summary?.jsonrpcId,
    userId: authInfo?.clientId,
  };
}

function logJsonRpcReceived(body: unknown, ctx: JsonRpcLogContext): void {
  const summary = summarizeJsonRpcBody(body);
  mcpVercelLogger.info(
    {
      event: "jsonrpc.received",
      jsonrpcMethod: ctx.jsonrpcMethod,
      jsonrpcId: ctx.jsonrpcId,
      sessionId: currentMcpSessionId(),
      userId: ctx.userId,
      isBatch: summary?.isBatch,
      batchSize: summary?.batchSize,
      parameters: summary?.params,
    },
    "MCP JSON-RPC request received",
  );
}

function jsonRpcOutcomeStatus(
  outcome: HandleJsonRpcOutcome,
): "success" | "error" {
  if (outcome.kind === "no_content") {
    return "success";
  }
  if (outcome.status >= 400) {
    return "error";
  }
  if ("error" in outcome.body) {
    return "error";
  }
  const result = outcome.body.result;
  if (
    typeof result === "object" &&
    result !== null &&
    !Array.isArray(result) &&
    (result as { isError?: boolean }).isError === true
  ) {
    return "error";
  }
  return "success";
}

function logJsonRpcCompleted(
  ctx: JsonRpcLogContext,
  outcome: HandleJsonRpcOutcome,
): void {
  const status = jsonRpcOutcomeStatus(outcome);
  const payload = {
    event: "jsonrpc.completed",
    jsonrpcMethod: ctx.jsonrpcMethod,
    jsonrpcId: ctx.jsonrpcId,
    sessionId: currentMcpSessionId(),
    userId: ctx.userId,
    durationMs: Date.now() - ctx.startedAt,
    status,
    httpStatus: outcome.status,
    responseKind: outcome.kind,
    result:
      outcome.kind === "json"
        ? summarizeJsonRpcResult(outcome.body)
        : { kind: "no_content" },
  };
  if (status === "error") {
    mcpVercelLogger.warn(payload, "MCP JSON-RPC request completed with error");
  } else {
    mcpVercelLogger.info(payload, "MCP JSON-RPC request completed");
  }
}

export function createJsonRpcHandler(server: VercelMcpServerDefinition) {
  return async function handleJsonRpc(
    body: unknown,
    authInfo: AuthInfo | undefined,
  ): Promise<HandleJsonRpcOutcome> {
    const logCtx = createJsonRpcLogContext(body, authInfo);
    logJsonRpcReceived(body, logCtx);
    await beginMcpInteractionAudit({ body, authInfo, logCtx });
    const outcome = await dispatchJsonRpc(server, body, authInfo);
    logJsonRpcCompleted(logCtx, outcome);
    const outcomeStatus = jsonRpcOutcomeStatus(outcome);
    const jsonRpcEnvelope = outcome.kind === "json" ? outcome.body : null;
    void finalizeMcpInteractionAudit({
      startedAt: logCtx.startedAt,
      httpStatus: outcome.status,
      jsonRpcEnvelope,
      outcomeStatus,
    }).catch((error: unknown) => {
      mcpVercelLogger.warn(
        {
          event: "audit.finalize.promise_rejected",
          err: error instanceof Error ? error : String(error),
          requestId: currentMcpRequestContext()?.requestId,
        },
        "MCP audit finalize promise rejected unexpectedly",
      );
    });
    return outcome;
  };
}

async function dispatchJsonRpc(
  server: VercelMcpServerDefinition,
  body: unknown,
  authInfo: AuthInfo | undefined,
): Promise<HandleJsonRpcOutcome> {
  if (Array.isArray(body)) {
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Batch requests are not supported.",
        },
        id: null,
      },
    };
  }

  if (body === null || typeof body !== "object") {
    return {
      kind: "json",
      status: 400,
      body: {
        jsonrpc: "2.0",
        error: { code: -32600, message: "Invalid Request" },
        id: null,
      },
    };
  }

  const msg = body as Record<string, unknown>;
  if (msg.jsonrpc !== "2.0") {
    return {
      kind: "json",
      status: 400,
      body: {
        jsonrpc: "2.0",
        error: { code: -32600, message: "Invalid JSON-RPC version" },
        id: extractJsonRpcId(msg.id),
      },
    };
  }

  const method = msg.method;
  if (typeof method !== "string") {
    return {
      kind: "json",
      status: 400,
      body: {
        jsonrpc: "2.0",
        error: { code: -32600, message: "Invalid method" },
        id: extractJsonRpcId(msg.id),
      },
    };
  }

  const id = extractJsonRpcId(msg.id);

  if (method === "notifications/initialized") {
    return { kind: "no_content", status: 204 };
  }

  if (method === "initialize") {
    const params = msg.params;
    let clientProtocol: unknown;
    if (
      params !== undefined &&
      params !== null &&
      typeof params === "object" &&
      !Array.isArray(params)
    ) {
      clientProtocol = (params as Record<string, unknown>).protocolVersion;
    }
    const protocolVersion = negotiateProtocolVersion(clientProtocol);
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          capabilities: { tools: {} },
          serverInfo: {
            name: server.name,
            version: server.version,
          },
          ...(server.instructions !== undefined
            ? { instructions: server.instructions }
            : {}),
        },
      },
    };
  }

  if (method === "tools/list") {
    const tools = await listToolsForMcpList(server, authInfo);
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id,
        result: { tools },
      },
    };
  }

  if (method === "ping") {
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id,
        result: {},
      },
    };
  }

  if (method === "tools/call") {
    return handleToolsCall(server, msg, id, authInfo);
  }

  return {
    kind: "json",
    status: 200,
    body: {
      jsonrpc: "2.0",
      error: { code: -32601, message: `Unknown method: ${method}` },
      id,
    },
  };
}

async function handleToolsCall(
  server: VercelMcpServerDefinition,
  msg: Record<string, unknown>,
  id: string | number | null,
  authInfo: AuthInfo | undefined,
): Promise<HandleJsonRpcOutcome> {
  const params = msg.params;
  if (
    params === undefined ||
    params === null ||
    typeof params !== "object" ||
    Array.isArray(params)
  ) {
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: "Invalid params" },
      },
    };
  }
  const record = params as Record<string, unknown>;
  const toolName = record.name;
  if (typeof toolName !== "string") {
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: "Invalid params: missing tool name" },
      },
    };
  }

  const tools = await server.listTools(authInfo);
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) {
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: `Unknown tool: ${toolName}` },
      },
    };
  }

  const rawArgs = record.arguments;
  const argsValue = rawArgs === undefined ? {} : rawArgs;
  if (
    typeof argsValue !== "object" ||
    argsValue === null ||
    Array.isArray(argsValue)
  ) {
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32602,
          message: "Invalid params: arguments must be an object",
        },
      },
    };
  }

  const parsed = await validateToolArgs(tool, argsValue);
  if (!parsed.ok) {
    mcpVercelLogger.warn(
      {
        event: "jsonrpc.tool.validation_failed",
        tool: toolName,
        sessionId: currentMcpSessionId(),
        userId: authInfo?.clientId,
        message: parsed.message,
      },
      "MCP tool call arguments failed validation",
    );
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `Input validation error: Invalid arguments for tool ${toolName}: ${parsed.message}`,
            },
          ],
          isError: true,
        },
      },
    };
  }

  try {
    const toolResult = await server.callTool(toolName, parsed.data, authInfo);
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id,
        result: toolResult,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    mcpVercelLogger.error(
      {
        event: "jsonrpc.tool.execution_failed",
        tool: toolName,
        sessionId: currentMcpSessionId(),
        userId: authInfo?.clientId,
        err: error,
      },
      "MCP tool call threw during execution",
    );
    return {
      kind: "json",
      status: 200,
      body: {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: `Error executing tool: ${message}` }],
          isError: true,
        },
      },
    };
  }
}

function extractJsonRpcId(value: unknown): string | number | null {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (value === null) {
    return null;
  }
  return null;
}
