import { AsyncLocalStorage } from "node:async_hooks";
import pino from "pino";

const mcpSessionContext = new AsyncLocalStorage<{ sessionId?: string }>();

type McpRequestContextStore = {
  requestId: string;
  userAgent?: string;
  mcpProtocolVersion?: string;
};

const mcpRequestContext = new AsyncLocalStorage<McpRequestContextStore>();

export function runWithMcpSession<T>(
  sessionId: string | undefined,
  fn: () => Promise<T> | T,
): Promise<T> | T {
  return mcpSessionContext.run({ sessionId }, fn);
}

export function currentMcpSessionId(): string | undefined {
  return mcpSessionContext.getStore()?.sessionId;
}

export function runWithMcpRequestContext<T>(
  context: McpRequestContextStore,
  fn: () => Promise<T> | T,
): Promise<T> | T {
  return mcpRequestContext.run(context, fn);
}

export function currentMcpRequestContext(): McpRequestContextStore | undefined {
  return mcpRequestContext.getStore();
}

export function resolveMcpSessionId(sources: {
  requestSessionId?: string;
  responseSessionId?: string;
  transportSessionId?: string;
  eventSessionId?: string;
}): string | undefined {
  return (
    sources.requestSessionId ??
    sources.transportSessionId ??
    sources.responseSessionId ??
    sources.eventSessionId
  );
}

type McpHandlerEvent =
  | {
      type: "SESSION_STARTED" | "SESSION_ENDED";
      timestamp: number;
      sessionId?: string;
      requestId?: string;
      transport: "SSE" | "HTTP";
      clientInfo?: { userAgent?: string; ip?: string };
    }
  | {
      type: "REQUEST_RECEIVED" | "REQUEST_COMPLETED";
      timestamp: number;
      sessionId?: string;
      requestId?: string;
      method: string;
      parameters?: unknown;
      result?: unknown;
      duration?: number;
      status: "success" | "error";
    }
  | {
      type: "ERROR";
      timestamp: number;
      sessionId?: string;
      requestId?: string;
      error: Error | string;
      context?: string;
      source: "request" | "session" | "system";
      severity: "warning" | "error" | "fatal";
    };

export const mcpVercelLogger = pino({
  level: process.env.VERCEL_MCP_LOG_LEVEL ?? "info",
  base: { component: "mcp-vercel" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type McpHttpHeaderInfo = {
  mcpSessionId?: string;
  mcpProtocolVersion?: string;
};

export type JsonRpcRequestSummary = {
  jsonrpcId?: string | number | null;
  jsonrpcMethod?: string;
  params?: Record<string, unknown>;
  isBatch?: boolean;
  batchSize?: number;
};

type HeaderReader = {
  get(name: string): string | null | undefined;
};

export function readMcpHttpHeaders(headers: HeaderReader): McpHttpHeaderInfo {
  const mcpSessionId =
    (headers.get("mcp-session-id") ?? headers.get("Mcp-Session-Id"))?.trim() ||
    undefined;
  const mcpProtocolVersion =
    (
      headers.get("mcp-protocol-version") ?? headers.get("Mcp-Protocol-Version")
    )?.trim() || undefined;
  return { mcpSessionId, mcpProtocolVersion };
}

export function summarizeJsonRpcBody(
  body: unknown,
): JsonRpcRequestSummary | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (Array.isArray(body)) {
    const methods = body
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" &&
          item !== null &&
          typeof item.method === "string",
      )
      .map((item) => item.method);
    return {
      isBatch: true,
      batchSize: body.length,
      jsonrpcMethod: methods.length > 0 ? methods.join(",") : undefined,
    };
  }
  if (typeof body !== "object") {
    return undefined;
  }
  const message = body as Record<string, unknown>;
  const summary: JsonRpcRequestSummary = {};
  if ("id" in message) {
    const id = message.id;
    if (typeof id === "string" || typeof id === "number" || id === null) {
      summary.jsonrpcId = id;
    }
  }
  if (typeof message.method === "string") {
    summary.jsonrpcMethod = message.method;
  }
  if (message.params !== undefined && message.params !== null) {
    if (typeof message.params === "object" && !Array.isArray(message.params)) {
      summary.params = summarizeToolArgs(
        message.params as Record<string, unknown>,
      );
    } else {
      summary.params = {
        kind: Array.isArray(message.params) ? "array" : typeof message.params,
      };
    }
  }
  return Object.keys(summary).length > 0 ? summary : undefined;
}

function summarizeJsonRpcParameters(
  parameters: unknown,
): Record<string, unknown> | undefined {
  if (parameters === undefined || parameters === null) {
    return undefined;
  }
  if (typeof parameters === "object" && !Array.isArray(parameters)) {
    return summarizeToolArgs(parameters as Record<string, unknown>);
  }
  return { kind: Array.isArray(parameters) ? "array" : typeof parameters };
}

export function summarizeJsonRpcResult(
  result: unknown,
): Record<string, unknown> | undefined {
  if (result === undefined || result === null) {
    return undefined;
  }
  if (typeof result !== "object") {
    return { kind: typeof result };
  }
  if (Array.isArray(result)) {
    return { kind: "array", length: result.length };
  }
  const envelope = result as Record<string, unknown>;
  if ("error" in envelope) {
    const error = envelope.error;
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : undefined;
    return { hasError: true, errorMessage: message };
  }
  if ("result" in envelope) {
    const value = envelope.result;
    if (value === undefined || value === null) {
      return { hasResult: true, resultKind: "empty" };
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      return {
        hasResult: true,
        resultKeys: Object.keys(value as Record<string, unknown>).slice(0, 12),
      };
    }
    return { hasResult: true, resultKind: typeof value };
  }
  return summarizeToolArgs(envelope);
}

export function summarizeToolArgs(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === "string") {
      summary[key] = value.length > 120 ? `${value.slice(0, 120)}…` : value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      summary[key] = value;
    } else if (Array.isArray(value)) {
      summary[key] = value.length <= 8 ? value : { length: value.length };
    } else {
      summary[key] = "[object]";
    }
  }
  return summary;
}

export function logMcpHandlerEvent(event: McpHandlerEvent): void {
  const sessionId = resolveMcpSessionId({ eventSessionId: event.sessionId });
  const base = {
    requestId: event.requestId,
    sessionId,
  };

  switch (event.type) {
    case "SESSION_STARTED":
      mcpVercelLogger.info(
        {
          ...base,
          event: "mcp.session.started",
          transport: event.transport,
          clientInfo: event.clientInfo,
        },
        "MCP session started",
      );
      return;
    case "SESSION_ENDED":
      mcpVercelLogger.info(
        {
          ...base,
          event: "mcp.session.ended",
          transport: event.transport,
        },
        "MCP session ended",
      );
      return;
    case "REQUEST_RECEIVED":
      mcpVercelLogger.info(
        {
          ...base,
          event: "mcp.request.received",
          jsonrpcMethod: event.method,
          parameters: summarizeJsonRpcParameters(event.parameters),
        },
        "MCP JSON-RPC request received",
      );
      return;
    case "REQUEST_COMPLETED": {
      const payload = {
        ...base,
        event: "mcp.request.completed",
        jsonrpcMethod: event.method,
        durationMs: event.duration,
        status: event.status,
        result: summarizeJsonRpcResult(event.result),
      };
      if (event.status === "error") {
        mcpVercelLogger.warn(
          payload,
          "MCP JSON-RPC request completed with error",
        );
      } else {
        mcpVercelLogger.info(payload, "MCP JSON-RPC request completed");
      }
      return;
    }
    case "ERROR": {
      const err =
        event.error instanceof Error
          ? event.error
          : new Error(String(event.error));
      const logPayload = {
        ...base,
        event: "mcp.error",
        context: event.context,
        source: event.source,
        severity: event.severity,
        err,
      };
      if (event.severity === "warning") {
        mcpVercelLogger.warn(logPayload, "MCP handler warning");
      } else {
        mcpVercelLogger.error(logPayload, "MCP handler error");
      }
    }
  }
}

async function readJsonRpcSummaryFromRequest(
  req: Request,
): Promise<JsonRpcRequestSummary | undefined> {
  if (req.method !== "POST") {
    return undefined;
  }
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined;
  }
  try {
    const body = await req.clone().json();
    return summarizeJsonRpcBody(body);
  } catch {
    return undefined;
  }
}

export function withMcpRequestLogging(
  handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const url = new URL(req.url);
    const mcpHeaders = readMcpHttpHeaders(req.headers);
    const jsonRpc = await readJsonRpcSummaryFromRequest(req);
    const requestSessionId = mcpHeaders.mcpSessionId;

    return runWithMcpSession(requestSessionId, async () =>
      runWithMcpRequestContext(
        {
          requestId,
          userAgent: req.headers.get("user-agent") ?? undefined,
          mcpProtocolVersion: mcpHeaders.mcpProtocolVersion,
        },
        async () => {
          mcpVercelLogger.info(
            {
              event: "http.request",
              requestId,
              method: req.method,
              path: url.pathname,
              userAgent: req.headers.get("user-agent") ?? undefined,
              sessionId: resolveMcpSessionId({ requestSessionId }),
              mcpProtocolVersion: mcpHeaders.mcpProtocolVersion,
              jsonRpc,
            },
            "MCP HTTP request received",
          );

          try {
            const response = await handler(req);
            const responseSessionId =
              response.headers.get("mcp-session-id") ?? undefined;
            mcpVercelLogger.info(
              {
                event: "http.response",
                requestId,
                method: req.method,
                path: url.pathname,
                status: response.status,
                durationMs: Date.now() - startedAt,
                userId: req.auth?.clientId,
                sessionId: resolveMcpSessionId({
                  requestSessionId,
                  responseSessionId,
                }),
                mcpProtocolVersion: mcpHeaders.mcpProtocolVersion,
                jsonRpc,
              },
              "MCP HTTP request completed",
            );
            return response;
          } catch (error) {
            mcpVercelLogger.error(
              {
                event: "http.error",
                requestId,
                method: req.method,
                path: url.pathname,
                durationMs: Date.now() - startedAt,
                userId: req.auth?.clientId,
                sessionId: resolveMcpSessionId({ requestSessionId }),
                mcpProtocolVersion: mcpHeaders.mcpProtocolVersion,
                jsonRpc,
                err: error,
              },
              "MCP HTTP request failed",
            );
            throw error;
          }
        },
      ),
    );
  };
}
