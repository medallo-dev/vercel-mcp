export function GET(): Response {
  return Response.json({
    ok: true,
    transport: "vercel-mcp-example",
  });
}
