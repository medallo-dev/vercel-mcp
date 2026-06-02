import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("interaction-log audit", () => {
  beforeEach(async () => {
    vi.resetModules();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SERVICE_ROLE_KEY;
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
    const envModule = await import("../env/load-local-env.ts");
    vi.spyOn(envModule, "loadLocalEnv").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("begin and finalize resolve without throwing when service role key is unset", async () => {
    const { beginMcpInteractionAudit, finalizeMcpInteractionAudit } =
      await import("./interaction-log.ts");
    await expect(
      beginMcpInteractionAudit({
        body: {
          jsonrpc: "2.0",
          id: "r1",
          method: "tools/call",
          params: {
            name: "ping_app",
            arguments: {},
          },
        },
        authInfo: undefined,
        logCtx: {
          jsonrpcMethod: "tools/call",
          jsonrpcId: "r1",
        },
      }),
    ).resolves.toBeUndefined();

    await expect(
      finalizeMcpInteractionAudit({
        startedAt: Date.now() - 5,
        httpStatus: 200,
        jsonRpcEnvelope: {
          jsonrpc: "2.0",
          id: "r1",
          result: { content: [{ type: "text", text: "ok" }] },
        },
        outcomeStatus: "success",
      }),
    ).resolves.toBeUndefined();
  });
});
