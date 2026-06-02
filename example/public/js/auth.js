import { createBrowserClient } from "https://esm.sh/@supabase/ssr@0.10.3?deps=@supabase/supabase-js@2.106.0";

let clientPromise;
let cachedConfig;

export async function loadConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  const r = await fetch("/api/config");
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.error) {
    throw new Error(
      body.error ?? body.message ?? `Config request failed (${r.status})`,
    );
  }
  if (!body.supabaseUrl || !body.supabaseAnonKey) {
    throw new Error("Invalid config response from server.");
  }
  cachedConfig = body;
  return cachedConfig;
}

export async function getSupabase() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { supabaseUrl, supabaseAnonKey } = await loadConfig();
      return createBrowserClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          flowType: "pkce",
          detectSessionInUrl: false,
        },
      });
    })();
  }
  return clientPromise;
}

export function oauthAuthorizationUrl(supabaseUrl, authorizationId) {
  const base = supabaseUrl.replace(/\/$/u, "");
  return `${base}/auth/v1/oauth/authorizations/${encodeURIComponent(authorizationId)}`;
}

export function oauthConsentUrl(supabaseUrl, authorizationId) {
  const base = supabaseUrl.replace(/\/$/u, "");
  return `${base}/auth/v1/oauth/authorizations/${encodeURIComponent(authorizationId)}/consent`;
}

export async function fetchAuthorizationDetails(
  supabaseUrl,
  anonKey,
  accessToken,
  authorizationId,
) {
  const res = await fetch(oauthAuthorizationUrl(supabaseUrl, authorizationId), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data.msg ??
      data.message ??
      data.error_description ??
      data.error ??
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function postOAuthConsent(
  supabaseUrl,
  anonKey,
  accessToken,
  authorizationId,
  action,
) {
  const res = await fetch(oauthConsentUrl(supabaseUrl, authorizationId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data.msg ??
      data.message ??
      data.error_description ??
      data.error ??
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}
