import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createMcpMethodHandlers } from "./create-mcp-post-handler.ts";

vi.mock("../audit/interaction-log.ts", () => ({
  beginMcpInteractionAudit: vi.fn(async () => undefined),
  finalizeMcpInteractionAudit: vi.fn(async () => undefined),
}));

vi.mock("../auth/jwt-validation.ts", () => ({
  getJwtValidationClient: vi.fn(),
}));

const server = {
  name: "test",
  version: "0.0.1",
  async listTools() {
    return [{ name: "ping_app", inputSchema: z.object({}) }];
  },
  async callTool() {
    return { content: [{ type: "text" as const, text: "ok" }] };
  },
};

describe(createMcpMethodHandlers, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 405 Method Not Allowed", async () => {
    const { GET } = createMcpMethodHandlers({ server });
    const res = GET();
    expect(res.status).toBe(405);
  });
});
