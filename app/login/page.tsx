"use client";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { SITE_NAME } from "@/lib/config";

const EMAIL_KEY = "looprank-login-email";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");
  const supabase = getBrowserClient();

  // Pre-fill the last-used email so returning users don't retype it.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {}
  }, []);

  if (!supabase) {
    return (
      <main className="container" style={{ paddingTop: 48 }}>
        <div className="card" style={{ maxWidth: 460 }}>
          <b>Not connected yet.</b>
          <p className="small muted">
            Supabase environment variables aren&rsquo;t set, so sign-in is disabled in this
            preview. Follow SETUP.md to connect the database, then this page goes live.
          </p>
        </div>
      </main>
    );
  }

  async function signInWithGoogle() {
    setGoogleBusy(true);
    setError("");
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser navigates away; only errors land here.
    if (error) {
      setError(error.message);
      setGoogleBusy(false);
    }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const cleaned = email.trim();
    const { error } = await supabase!.auth.signInWithOtp({
      email: cleaned,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      try {
        window.localStorage.setItem(EMAIL_KEY, cleaned);
      } catch {}
      setSent(true);
    }
  }

  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <div className="card" style={{ maxWidth: 460 }}>
        <h1 style={{ marginTop: 0, fontSize: 24 }}>Sign in to {SITE_NAME}</h1>
        {sent ? (
          <p>
            <b>Check your email.</b>
            <br />
            <span className="small muted">
              We sent a sign-in link to {email}. Click it on this device and you&rsquo;ll be
              signed in — no password needed.
            </span>
          </p>
        ) : (
          <>
            <button
              type="button"
              className="btn"
              onClick={signInWithGoogle}
              disabled={googleBusy}
              style={{
                width: "100%",
                padding: "11px 16px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
            >
              <GoogleLogo />
              {googleBusy ? "Opening Google…" : "Continue with Google"}
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                margin: "16px 0",
                color: "var(--text-muted)",
                fontSize: 12.5,
              }}
            >
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
              or
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            <form onSubmit={sendLink}>
              <p className="small muted" style={{ marginTop: 0 }}>
                No passwords — we email you a magic sign-in link. New here? Same box; your
                account is created on first sign-in.
              </p>
              <label className="field" htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                className="input"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              {error && <p className="error-text">{error}</p>}
              <button className="btn btn-primary" disabled={busy} style={{ marginTop: 14 }}>
                {busy ? "Sending…" : "Email me a sign-in link"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
