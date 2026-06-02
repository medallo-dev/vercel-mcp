import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  loadLocalEnv,
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from "../env/load-local-env.ts";

let validationClient: SupabaseClient | null = null;

export function getJwtValidationClient(): SupabaseClient {
  if (validationClient) {
    return validationClient;
  }
  loadLocalEnv();
  const url = resolveSupabaseUrl();
  const anonKey = resolveSupabaseAnonKey();
  validationClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return validationClient;
}

export function resetJwtValidationClientForTests(): void {
  validationClient = null;
}
