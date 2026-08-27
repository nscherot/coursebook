"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export default function ProfilePage() {
  const router = useRouter();
  const supabase = getBrowserClient();
  const [loaded, setLoaded] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [origUsername, setOrigUsername] = useState("");

  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [location, setLocation] = useState("");
  const [homeCourse, setHomeCourse] = useState("");
  const [handicap, setHandicap] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setWelcome(new URLSearchParams(window.location.search).get("welcome") === "1");
    if (!supabase) return;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      setUserId(userData.user.id);
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (!p) {
        router.replace("/onboarding");
        return;
      }
      const prof = p as Profile;
      setUsername(prof.username);
      setOrigUsername(prof.username);
      setFirstName(prof.first_name || "");
      setLastName(prof.last_name || "");
      setLocation(prof.location || "");
      setHomeCourse(prof.home_course || "");
      setHandicap(prof.handicap != null ? String(prof.handicap) : "");
      setLoaded(true);
    })();
  }, [supabase, router]);

  if (!supabase) {
    return (
      <main className="container" style={{ paddingTop: 48 }}>
        <div className="card" style={{ maxWidth: 460 }}>
          <b>Not connected yet.</b>
          <p className="small muted">Set up Supabase first (see SETUP.md).</p>
        </div>
      </main>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setError("");
    setSaved(false);

    const uname = username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(uname)) {
      setError("Username must be 3–30 characters: lowercase letters, numbers, hyphens.");
      return;
    }
    let hcp: number | null = null;
    if (handicap.trim() !== "") {
      hcp = Number(handicap);
      if (!Number.isFinite(hcp) || hcp < -10 || hcp > 54) {
        setError("Handicap index should be a number between -10 (plus handicaps) and 54.");
        return;
      }
      hcp = Math.round(hcp * 10) / 10;
    }

    setBusy(true);
    const { error } = await supabase!
      .from("profiles")
      .update({
        username: uname,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        location: location.trim() || null,
        home_course: homeCourse.trim() || null,
        handicap: hcp,
      })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      setError(
        error.code === "23505" ? "That username is taken — try another." : error.message
      );
      return;
    }
    setOrigUsername(uname);
    if (welcome) {
      router.replace("/edit");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <main className="container" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
        {welcome ? (
          <>
            <h1 style={{ marginTop: 0, fontSize: 24 }}>Round out your profile</h1>
            <p className="small muted" style={{ marginTop: -6 }}>
              A few quick details for your public page — all optional except your username.
            </p>
          </>
        ) : (
          <h1 style={{ marginTop: 0, fontSize: 24 }}>Your profile</h1>
        )}

        {!loaded ? (
          <p className="muted small">Loading…</p>
        ) : (
          <form onSubmit={save} style={{ display: "grid", gap: 14 }}>
            <div>
              <label className="field" htmlFor="username">Username</label>
              <input
                id="username"
                className="input"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <div className="small muted" style={{ marginTop: 4 }}>
                Your public page: /u/{username.trim().toLowerCase() || "username"}
                {username.trim().toLowerCase() !== origUsername && (
                  <span style={{ color: "var(--gold)" }}>
                    {" "}— changing this breaks links you&rsquo;ve already shared
                  </span>
                )}
              </div>
            </div>

            <div className="form-grid">
              <div>
                <label className="field" htmlFor="firstName">First name</label>
                <input id="firstName" className="input" value={firstName}
                  autoComplete="given-name"
                  onChange={(e) => setFirstName(e.target.value)} placeholder="Nate" />
              </div>
              <div>
                <label className="field" htmlFor="lastName">Last name</label>
                <input id="lastName" className="input" value={lastName}
                  autoComplete="family-name"
                  onChange={(e) => setLastName(e.target.value)} placeholder="Scherotter" />
              </div>
            </div>

            <div>
              <label className="field" htmlFor="location">Location</label>
              <input id="location" className="input" value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Boston, MA" />
            </div>

            <div>
              <label className="field" htmlFor="homeCourse">Home course</label>
              <input id="homeCourse" className="input" value={homeCourse}
                onChange={(e) => setHomeCourse(e.target.value)}
                placeholder="Sugarloaf Golf Club" />
            </div>

            <div>
              <label className="field" htmlFor="handicap">Handicap index</label>
              <input id="handicap" className="input" value={handicap}
                onChange={(e) => setHandicap(e.target.value)}
                inputMode="decimal"
                placeholder="8.4"
                style={{ maxWidth: 140 }} />
              <div className="small muted" style={{ marginTop: 4 }}>
                Use a negative number for plus handicaps (e.g. -1.2 shows as +1.2).
              </div>
            </div>

            {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Saving…" : welcome ? "Save and continue" : "Save profile"}
              </button>
              {welcome && (
                <a className="rowlink muted" onClick={() => router.replace("/edit")}>
                  Skip for now
                </a>
              )}
              {saved && <span className="success-text">Saved ✓</span>}
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
