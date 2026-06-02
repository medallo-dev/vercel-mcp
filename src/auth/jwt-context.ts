import { AsyncLocalStorage } from "node:async_hooks";

const mcpJwtContext = new AsyncLocalStorage<{ jwt: string; userId: string }>();

export function runWithMcpJwt<T>(
  context: { jwt: string; userId: string },
  fn: () => Promise<T> | T,
): Promise<T> | T {
  return mcpJwtContext.run(context, fn);
}

export function currentMcpJwt(): { jwt: string; userId: string } | null {
  return mcpJwtContext.getStore() ?? null;
}
