import { getSupabase } from "./auth.js";

const params = new URLSearchParams(window.location.search);
const redirectParam = params.get("redirect");
const redirect = redirectParam ?? "/";
const errorParam = params.get("error");

const errEl = document.getElementById("error");
const sessionLoading = document.getElementById("session-loading");
const signInPanel = document.getElementById("sign-in-panel");
const loggedInPanel = document.getElementById("logged-in-panel");
const loggedInMessage = document.getElementById("logged-in-message");

if (errorParam && errEl) {
  errEl.textContent = errorParam;
}

function setError(message) {
  if (errEl) errEl.textContent = message;
}

function safeRedirectPath(next) {
  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

function shouldForwardAfterLogin() {
  const next = safeRedirectPath(redirectParam ?? "/");
  return (
    redirectParam != null &&
    next !== "/" &&
    next !== "/login"
  );
}

function displayIdentity(user) {
  return user.email ?? user.phone ?? "Signed-in user";
}

function showLoggedIn(userOrEmail) {
  const text =
    typeof userOrEmail === "string"
      ? userOrEmail
      : displayIdentity(userOrEmail);
  if (sessionLoading) sessionLoading.hidden = true;
  if (signInPanel) signInPanel.hidden = true;
  if (loggedInPanel) loggedInPanel.hidden = false;
  if (loggedInMessage) {
    loggedInMessage.textContent = `You are logged in as ${text}`;
  }
}

function showSignIn() {
  if (sessionLoading) sessionLoading.hidden = true;
  if (signInPanel) signInPanel.hidden = false;
  if (loggedInPanel) loggedInPanel.hidden = true;
}

async function init() {
  try {
    const supabase = await getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && shouldForwardAfterLogin()) {
      if (sessionLoading) sessionLoading.hidden = true;
      window.location.href = safeRedirectPath(redirectParam ?? "/");
      return;
    }

    if (user) {
      showLoggedIn(user);
    } else {
      showSignIn();
    }

    document.getElementById("logout")?.addEventListener("click", async () => {
      try {
        setError("");
        const supabaseClient = await getSupabase();
        await supabaseClient.auth.signOut();
        showSignIn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign out failed.");
      }
    });
  } catch (e) {
    setError(e instanceof Error ? e.message : "Could not load session.");
    showSignIn();
  }
}

void init();

document.getElementById("password-form")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const fd = new FormData(form);
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) {
    setError("Enter email and password.");
    return;
  }
  try {
    setError("");
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      return;
    }
    const signedInEmail = data.user ? displayIdentity(data.user) : email;
    if (shouldForwardAfterLogin()) {
      window.location.href = safeRedirectPath(redirectParam ?? "/");
      return;
    }
    showLoggedIn(signedInEmail);
  } catch (e) {
    setError(e instanceof Error ? e.message : "Sign-in failed.");
  }
});

document.getElementById("google-sign-in")?.addEventListener("click", async () => {
  try {
    setError("");
    const supabase = await getSupabase();
    const callback = new URL("/api/auth/callback", window.location.origin);
    callback.searchParams.set("next", redirect);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    if (error) {
      setError(error.message);
    }
  } catch (e) {
    setError(e instanceof Error ? e.message : "Sign-in failed.");
  }
});
