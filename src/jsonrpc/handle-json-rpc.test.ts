import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { DEFAULT_NEGOTIATED_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createJsonRpcHandler,
  type VercelMcpServerDefinition,
} from "./handle-json-rpc.ts";

vi.mock("../audit/interaction-log.ts", () => ({
  beginMcpInteractionAudit: vi.fn(async () => undefined),
  finalizeMcpInteractionAudit: vi.fn(async () => undefined),
}));

const stubServer: VercelMcpServerDefinition = {
  name: "test-server",
  version: "1.0.0",
  instructions: "Test MCP server",
  async listTools(_auth) {
    return [
      {
        name: "ping_app",
        description: "Ping the app",
        inputSchema: z.object({}),
      },
    ];
  },
  async callTool(name, _args, auth) {
    if (!auth) {
      return {
        content: [{ type: "text", text: "Unauthorized" }],
        isError: true,
      };
    }
    if (name === "ping_app") {
      return { content: [{ type: "text", text: "pong" }] };
    }
    throw new Error(`Unknown tool: ${name}`);
  },
};

const dummyAuth: AuthInfo = {
  token: "test-jwt",
  clientId: "test-user",
  scopes: ["mcp"],
};

describe(createJsonRpcHandler, () => {
  const handleJsonRpc = createJsonRpcHandler(stubServer);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects batch JSON-RPC requests", async () => {
    const out = await handleJsonRpc(
      [{ jsonrpc: "2.0", id: 1, method: "ping" }],
      undefined,
    );
    expect(out.kind).toBe("json");
    if (out.kind !== "json" || !("error" in out.body)) {
      throw new Error("expected error");
    }
    expect(out.body.error.code).toBe(-32600);
  });

  it("initialize returns negotiated protocol and instructions", async () => {
    const out = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2099-01-01" },
      },
      undefined,
    );
    expect(out.kind).toBe("json");
    if (out.kind !== "json" || !("result" in out.body)) {
      throw new Error("expected result");
    }
    const result = out.body.result as Record<string, unknown>;
    expect(result.protocolVersion).toBe(DEFAULT_NEGOTIATED_PROTOCOL_VERSION);
    expect(result.instructions).toBe("Test MCP server");
    expect(result.serverInfo).toEqual({
      name: "test-server",
      version: "1.0.0",
    });
  });

  it("tools/list returns stub tools", async () => {
    const out = await handleJsonRpc(
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      dummyAuth,
    );
    expect(out.kind).toBe("json");
    if (out.kind !== "json" || !("result" in out.body)) {
      throw new Error("expected result");
    }
    const tools = (out.body.result as { tools: { name: string }[] }).tools;
    expect(tools.map((t) => t.name)).toEqual(["ping_app"]);
  });

  it("returns Method not found for unknown methods", async () => {
    const out = await handleJsonRpc(
      { jsonrpc: "2.0", id: 3, method: "flubber/dance" },
      undefined,
    );
    expect(out.kind).toBe("json");
    if (out.kind !== "json" || !("error" in out.body)) {
      throw new Error("expected error");
    }
    expect(out.body.error.code).toBe(-32601);
  });

  it("tools/call executes ping_app with auth", async () => {
    const out = await handleJsonRpc(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "ping_app",
          arguments: {},
        },
      },
      dummyAuth,
    );
    expect(out.kind).toBe("json");
    if (out.kind !== "json" || !("result" in out.body)) {
      throw new Error("expected result");
    }
    const result = out.body.result as { content: { text: string }[] };
    expect(result.content[0]?.text).toBe("pong");
  });

  it("notifications/initialized yields 204", async () => {
    const out = await handleJsonRpc(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      undefined,
    );
    expect(out.kind).toBe("no_content");
    expect(out.status).toBe(204);
  });
});
