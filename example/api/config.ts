import { readPublicSupabaseConfig } from "../../src/env/load-local-env.ts";

export function GET(): Response {
  try {
    const { supabaseUrl, supabaseAnonKey } = readPublicSupabaseConfig();
    return Response.json({ supabaseUrl, supabaseAnonKey });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: message }, { status: 500 });
  }
}
