import { beforeEach, describe, expect, it, vi } from "vitest";
import { withSupabaseMcpAuth } from "./supabase-mcp-auth.ts";

vi.mock("./jwt-validation.ts", () => ({
  getJwtValidationClient: vi.fn(),
}));

import { getJwtValidationClient } from "./jwt-validation.ts";

describe(withSupabaseMcpAuth, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth required and token missing", async () => {
    const handler = withSupabaseMcpAuth(
      () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      { required: true, resourceUrl: "https://example.com" },
    );
    const req = new Request("https://example.com/mcp", { method: "POST" });
    const res = await handler(req);
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("resource_metadata");
  });

  it("sets req.auth when token verifies", async () => {
    vi.mocked(getJwtValidationClient).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "user-123", email: "a@b.com" } },
          error: null,
        })),
      },
    } as unknown as ReturnType<typeof getJwtValidationClient>);

    let capturedAuth: unknown;
    const handler = withSupabaseMcpAuth(
      (req) => {
        capturedAuth = req.auth;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
      { required: true, resourceUrl: "https://example.com" },
    );
    const req = new Request("https://example.com/mcp", {
      method: "POST",
      headers: { Authorization: "Bearer valid-jwt" },
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(capturedAuth).toMatchObject({
      token: "valid-jwt",
      clientId: "user-123",
      scopes: ["mcp"],
    });
  });
});
