"use client";
import { useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { SITE_NAME, GOOGLE_CLIENT_ID } from "@/lib/config";

const EMAIL_KEY = "looprank-login-email";

// Loads Google Identity Services once; resolves when window.google is ready.
let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      reject(new Error("Google sign-in failed to load"));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

function genNonce(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [googleFailed, setGoogleFailed] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const supabase = getBrowserClient();

  // Pre-fill the last-used email so returning users don't retype it.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {}
  }, []);

  // Google sign-in via Google Identity Services + signInWithIdToken.
  // The token exchange happens on THIS page, so Google's consent UI shows
  // Loop Ranks / loopranks.com — not the Supabase project domain.
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      try {
        await loadGis();
        if (cancelled || !googleBtnRef.current) return;
        const nonce = genNonce();
        const hashedNonce = await sha256Hex(nonce);
        const g = (window as any).google;
        g.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashedNonce,
          use_fedcm_for_prompt: true,
          callback: async (resp: { credential: string }) => {
            setSigningIn(true);
            setError("");
            const { error } = await supabase!.auth.signInWithIdToken({
              provider: "google",
              token: resp.credential,
              nonce,
            });
            if (error) {
              setError(error.message);
              setSigningIn(false);
              return;
            }
            // New users go to onboarding, returning users to their list.
            let dest = "/edit";
            const { data: userData } = await supabase!.auth.getUser();
            if (userData.user) {
              const { data: profile } = await supabase!
                .from("profiles")
                .select("id")
                .eq("id", userData.user.id)
                .maybeSingle();
              if (!profile) dest = "/onboarding";
            }
            window.location.assign(dest);
          },
        });
        const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const width = Math.min(Math.round(googleBtnRef.current.offsetWidth) || 360, 400);
        g.accounts.id.renderButton(googleBtnRef.current, {
          type: "standard",
          theme: dark ? "filled_black" : "outline",
          text: "continue_with",
          shape: "pill",
          size: "large",
          width,
          logo_alignment: "left",
        });
      } catch {
        if (!cancelled) setGoogleFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

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

  // Fallback if the Google script is blocked: classic redirect flow.
  async function signInWithGoogleRedirect() {
    setBusy(true);
    setError("");
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
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
            {signingIn ? (
              <p className="small muted" style={{ textAlign: "center", padding: "10px 0" }}>
                Signing you in with Google…
              </p>
            ) : googleFailed ? (
              <button
                type="button"
                className="btn"
                onClick={signInWithGoogleRedirect}
                disabled={busy}
                style={{ width: "100%", padding: "11px 16px", fontWeight: 600 }}
              >
                Continue with Google
              </button>
            ) : (
              <div
                ref={googleBtnRef}
                style={{ display: "flex", justifyContent: "center", minHeight: 44 }}
              />
            )}

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
