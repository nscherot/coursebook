"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import PasteImport from "@/components/PasteImport";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = getBrowserClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [importStep, setImportStep] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [listTitle, setListTitle] = useState("My Top 25 Golf Courses");
  const [listSize, setListSize] = useState(25);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login");
      else setUserId(data.user.id);
    });
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
    const uname = username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(uname)) {
      setError("Username must be 3–30 characters: lowercase letters, numbers, hyphens.");
      return;
    }
    setBusy(true);
    setError("");
    const { error } = await supabase!.from("profiles").insert({
      id: userId,
      username: uname,
      display_name: displayName.trim() || uname,
      list_title: listTitle.trim() || "My Top Courses",
      list_size: listSize,
    });
    setBusy(false);
    if (error) {
      setError(
        error.code === "23505" ? "That username is taken — try another." : error.message
      );
      return;
    }
    setImportStep(true); // step 2: bring your existing list
  }

  if (importStep && userId) {
    return (
      <main className="container" style={{ paddingTop: 48 }}>
        <div style={{ maxWidth: 640 }}>
          <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>You&rsquo;re in! One more thing…</h1>
          <p className="small muted" style={{ margin: "0 0 14px" }}>
            Already keep a list of courses you&rsquo;ve played? Paste it and it becomes your
            ranked map in one step.
          </p>
          <PasteImport
            supabase={supabase!}
            profile={{ id: userId, list_size: listSize }}
            existingCount={0}
            onDone={() => router.replace("/profile?welcome=1")}
            onSkip={() => router.replace("/profile?welcome=1")}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <div className="card" style={{ maxWidth: 520 }}>
        <h1 style={{ marginTop: 0, fontSize: 24 }}>Set up your list</h1>
        <form onSubmit={save} style={{ display: "grid", gap: 14 }}>
          <div>
            <label className="field" htmlFor="username">Username (your public page URL)</label>
            <input id="username" className="input" required value={username}
              onChange={(e) => setUsername(e.target.value)} placeholder="nate" />
            <div className="small muted" style={{ marginTop: 4 }}>
              Your list will live at /u/{username.trim().toLowerCase() || "username"}
            </div>
          </div>
          <div>
            <label className="field" htmlFor="displayName">Display name</label>
            <input id="displayName" className="input" value={displayName}
              onChange={(e) => setDisplayName(e.target.value)} placeholder="Nate" />
          </div>
          <div>
            <label className="field" htmlFor="listTitle">List title</label>
            <input id="listTitle" className="input" value={listTitle}
              onChange={(e) => setListTitle(e.target.value)} />
          </div>
          <div>
            <label className="field" htmlFor="listSize">List size</label>
            <select id="listSize" className="input" value={listSize}
              onChange={(e) => setListSize(Number(e.target.value))}>
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>Top {n}</option>
              ))}
            </select>
            <div className="small muted" style={{ marginTop: 4 }}>
              You can rank fewer while you work up to it — this is just the cap.
            </div>
          </div>
          {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
          <div>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Create my list"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
