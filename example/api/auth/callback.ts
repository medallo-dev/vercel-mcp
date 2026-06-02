import { createServerClient } from "@supabase/ssr";
import { parse, serialize } from "cookie";
import { readPublicSupabaseConfig } from "../../../src/env/load-local-env.ts";

function sanitizeNext(next: string, origin: string): string {
  const o = new URL(origin);
  if (!next || next === "/") {
    return "/";
  }
  if (next.startsWith("/")) {
    if (next.startsWith("//")) {
      return "/";
    }
    return next;
  }
  try {
    const u = new URL(next);
    if (u.origin === o.origin) {
      return u.pathname + u.search + u.hash;
    }
  } catch {
    /* invalid absolute URL */
  }
  return "/";
}

export async function GET(request: Request): Promise<Response> {
  let supabaseUrl: string;
  let supabaseAnonKey: string;
  try {
    ({ supabaseUrl, supabaseAnonKey } = readPublicSupabaseConfig());
  } catch (e) {
    const message = e instanceof Error ? e.message : "Configuration error";
    return Response.json({ error: message }, { status: 500 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNext(url.searchParams.get("next") ?? "/", url.origin);

  const headers = new Headers();
  headers.set("Cache-Control", "private, no-store, max-age=0");

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const raw = request.headers.get("cookie") ?? "";
        const parsed = parse(raw);
        return Object.entries(parsed).map(([name, value]) => ({
          name,
          value: value ?? "",
        }));
      },
      setAll(cookiesToSet, responseHeadersFromLib) {
        for (const { name, value, options } of cookiesToSet) {
          headers.append("Set-Cookie", serialize(name, value, options));
        }
        for (const [key, val] of Object.entries(responseHeadersFromLib)) {
          headers.set(key, val);
        }
      },
    },
  });

  if (!code) {
    headers.set("Location", "/login");
    return new Response(null, { status: 302, headers });
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL("/login", url.origin);
    loginUrl.searchParams.set("error", error.message);
    loginUrl.searchParams.set("redirect", next);
    headers.set("Location", `${loginUrl.pathname}${loginUrl.search}`);
    return new Response(null, { status: 302, headers });
  }

  headers.set("Location", next);
  return new Response(null, { status: 302, headers });
}
