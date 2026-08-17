"use client";
import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { SITE_NAME } from "@/lib/config";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const supabase = getBrowserClient();

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

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase!.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
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
          <form onSubmit={sendLink}>
            <p className="small muted" style={{ marginTop: 0 }}>
              No passwords — we email you a magic sign-in link. New here? Same box; your
              account is created on first sign-in.
            </p>
            <label className="field" htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary" disabled={busy} style={{ marginTop: 14 }}>
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
