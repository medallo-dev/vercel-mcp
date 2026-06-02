import { createMcpMethodHandlers } from "../../src/transport/create-mcp-post-handler.ts";
import { exampleMcpServer } from "../mcp/server.ts";

const handlers = createMcpMethodHandlers({ server: exampleMcpServer });

export const POST = handlers.POST;
export const GET = handlers.GET;
export const DELETE = handlers.DELETE;
