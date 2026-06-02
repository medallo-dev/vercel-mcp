import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";
import type { VercelMcpServerDefinition } from "../../src/jsonrpc/handle-json-rpc.ts";

export const exampleMcpServer: VercelMcpServerDefinition = {
  name: "vercel-mcp-example",
  version: "1.0.0",
  instructions: "Example MCP server built with @medallo-dev/vercel-mcp.",
  async listTools(_auth: AuthInfo | undefined) {
    return [
      {
        name: "ping_app",
        title: "Ping app",
        description: "Returns a pong response to verify MCP wiring.",
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
