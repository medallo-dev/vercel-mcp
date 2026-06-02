import {
  fetchAuthorizationDetails,
  getSupabase,
  loadConfig,
  postOAuthConsent,
} from "./auth.js";

const root = document.getElementById("app");
const params = new URLSearchParams(window.location.search);
const authorizationId = params.get("authorization_id");

function showError(message) {
  if (!root) {
    return;
  }
  const p = document.createElement("p");
  p.className = "err";
  p.textContent = message;
  root.replaceChildren(p);
}

async function main() {
  if (!root) {
    return;
  }
  if (!authorizationId) {
    showError("Missing authorization_id. Start the flow from your OAuth client.");
    return;
  }

  const supabase = await getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const back = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    window.location.href = `/login?redirect=${encodeURIComponent(back)}`;
    return;
  }

  const { supabaseUrl, supabaseAnonKey } = await loadConfig();

  let details;
  try {
    details = await fetchAuthorizationDetails(
      supabaseUrl,
      supabaseAnonKey,
      session.access_token,
      authorizationId,
    );
  } catch (e) {
    showError(e instanceof Error ? e.message : "Failed to load authorization.");
    return;
  }

  if (details.redirect_url && !details.authorization_id) {
    window.location.href = details.redirect_url;
    return;
  }

  const client = details.client ?? {};
  const scopeList = (details.scope ?? "")
    .split(/\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);

  root.innerHTML = `
    <h1>Authorize access</h1>
    <p class="sub">An application is requesting access to your account.</p>
    <p class="meta"><strong>Application</strong><br />${escapeHtml(client.name || client.id || "Unknown client")}</p>
    ${client.uri ? `<p class="meta muted">${escapeHtml(client.uri)}</p>` : ""}
    <p class="meta"><strong>Redirect URI</strong><br /><span class="muted">${escapeHtml(details.redirect_uri ?? "—")}</span></p>
    ${scopeList.length ? `<div><strong class="meta">Requested permissions</strong><ul class="scopes">${scopeList.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></div>` : ""}
    <div class="actions">
      <button type="button" class="btn-primary" id="approve">Approve</button>
      <button type="button" class="btn-secondary" id="deny">Deny</button>
    </div>
  `;

  document.getElementById("approve")?.addEventListener("click", async () => {
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s) {
        showError("Session expired. Please sign in again.");
        return;
      }
      const out = await postOAuthConsent(
        supabaseUrl,
        supabaseAnonKey,
        s.access_token,
        authorizationId,
        "approve",
      );
      if (out.redirect_url) {
        window.location.href = out.redirect_url;
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : "Approval failed.");
    }
  });

  document.getElementById("deny")?.addEventListener("click", async () => {
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s) {
        showError("Session expired. Please sign in again.");
        return;
      }
      const out = await postOAuthConsent(
        supabaseUrl,
        supabaseAnonKey,
        s.access_token,
        authorizationId,
        "deny",
      );
      if (out.redirect_url) {
        window.location.href = out.redirect_url;
      }
    } catch (e) {
      showError(e instanceof Error ? e.message : "Could not deny request.");
    }
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

main();
