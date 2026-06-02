import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const DEFAULT_ENV_FILES = [".env.local"];

let envLoaded = false;

export function loadLocalEnv(envFiles: string[] = DEFAULT_ENV_FILES): void {
  if (envLoaded) {
    return;
  }

  for (const envFile of envFiles) {
    const absolutePath = resolve(envFile);
    if (!existsSync(absolutePath)) {
      continue;
    }

    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(absolutePath);
      continue;
    }

    const content = readFileSync(absolutePath, "utf8");
    for (const line of content.split(/\r?\n/u)) {
      if (!line || line.trim().startsWith("#")) {
        continue;
      }

      const separator = line.indexOf("=");
      if (separator <= 0) {
        continue;
      }

      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }

  envLoaded = true;
}

export function resolveSupabaseUrl(): string {
  loadLocalEnv();
  return (
    process.env.SUPABASE_URL ?? process.env.API_URL ?? "http://127.0.0.1:54321"
  );
}

export function resolveSupabaseAnonKey(): string {
  loadLocalEnv();
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error(
      "Missing Supabase anon key. Set SUPABASE_ANON_KEY or export the output of `supabase status -o env`.",
    );
  }
  return anonKey;
}

export function readPublicSupabaseConfig(): {
  supabaseUrl: string;
  supabaseAnonKey: string;
} {
  loadLocalEnv();
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ?? process.env.API_URL?.trim();
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing SUPABASE_URL (or API_URL) and SUPABASE_ANON_KEY for the OAuth UI.",
    );
  }
  return { supabaseUrl, supabaseAnonKey };
}
