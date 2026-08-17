"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getBrowserClient, scorecardUrl } from "@/lib/supabase/client";
import type { Entry, Profile, Round } from "@/lib/types";

const CourseMap = dynamic(() => import("@/components/CourseMap"), { ssr: false });

type Status = "loading" | "no-config" | "signed-out" | "no-profile" | "ready";

export default function EditPage() {
  const supabase = useMemo(() => getBrowserClient(), []);
  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const reload = useCallback(async () => {
    if (!supabase) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setStatus("signed-out");
      return;
    }
    const uid = userData.user.id;
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (!prof) {
      setStatus("no-profile");
      return;
    }
    setProfile(prof as Profile);
    const [{ data: ents }, { data: rds }] = await Promise.all([
      supabase.from("entries").select("*").eq("user_id", uid).order("rank"),
      supabase.from("rounds").select("*").eq("user_id", uid).order("played_on", { ascending: false }),
    ]);
    setEntries((ents || []) as Entry[]);
    setRounds((rds || []) as Round[]);
    setStatus("ready");
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setStatus("no-config");
      return;
    }
    reload();
  }, [supabase, reload]);

  if (status === "no-config")
    return (
      <Notice title="Not connected yet.">
        Supabase environment variables aren&rsquo;t set, so the editor is disabled in this preview.
        Follow SETUP.md to connect the database.
      </Notice>
    );
  if (status === "loading") return <Notice title="Loading…"> </Notice>;
  if (status === "signed-out")
    return (
      <Notice title="You're signed out.">
        <Link href="/login">Sign in</Link> to build your list.
      </Notice>
    );
  if (status === "no-profile")
    return (
      <Notice title="Almost there.">
        <Link href="/onboarding">Finish setting up your profile</Link> to start your list.
      </Notice>
    );

  return (
    <Editor
      supabase={supabase!}
      profile={profile!}
      entries={entries}
      rounds={rounds}
      setEntries={setEntries}
      setRounds={setRounds}
      selectedId={selectedId}
      setSelectedId={setSelectedId}
      msg={msg}
      setMsg={setMsg}
      reload={reload}
    />
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <div className="card" style={{ maxWidth: 480 }}>
        <b>{title}</b>
        <p className="small muted">{children}</p>
      </div>
    </main>
  );
}

/* ---------------- editor ---------------- */

function Editor(props: any) {
  const { supabase, profile, entries, rounds, setEntries, setRounds, selectedId, setSelectedId, msg, setMsg, reload } = props;

  const points = useMemo(
    () => entries.map((e: Entry) => ({ id: e.id, rank: e.rank, name: e.name, location: e.location, lat: e.lat, lng: e.lng })),
    [entries]
  );

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  /* ----- add course ----- */
  const [newName, setNewName] = useState("");
  const [newLoc, setNewLoc] = useState("");
  const [newLat, setNewLat] = useState<string>("");
  const [newLng, setNewLng] = useState<string>("");
  const [geoBusy, setGeoBusy] = useState(false);
  const [addBusy, setAddBusy] = useState(false);

  async function geocode() {
    const q = `${newName} ${newLoc}`.trim();
    if (!q) return;
    setGeoBusy(true);
    setMsg("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
      );
      const results = await res.json();
      if (results.length > 0) {
        setNewLat(Number(results[0].lat).toFixed(5));
        setNewLng(Number(results[0].lon).toFixed(5));
        setMsg(`Pinned near: ${results[0].display_name}`);
      } else {
        setMsg("No match found — try adding the town/state, or type coordinates manually.");
      }
    } catch {
      setMsg("Location lookup failed — you can type coordinates manually.");
    }
    setGeoBusy(false);
  }

  async function addCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    if (entries.length >= profile.list_size) {
      setMsg(`Your list is capped at ${profile.list_size}. Remove a course or raise the cap in settings.`);
      return;
    }
    setAddBusy(true);
    const { error } = await supabase.from("entries").insert({
      user_id: profile.id,
      rank: entries.length + 1,
      name: newName.trim(),
      location: newLoc.trim(),
      lat: newLat ? Number(newLat) : null,
      lng: newLng ? Number(newLng) : null,
      note: "",
    });
    setAddBusy(false);
    if (error) setMsg(error.message);
    else {
      setNewName(""); setNewLoc(""); setNewLat(""); setNewLng("");
      setMsg("");
      reload();
    }
  }

  /* ----- reorder / edit / delete ----- */
  async function move(entry: Entry, dir: -1 | 1) {
    const idx = entries.findIndex((e: Entry) => e.id === entry.id);
    const other = entries[idx + dir];
    if (!other) return;
    const updated = [...entries];
    updated[idx] = { ...other, rank: entry.rank };
    updated[idx + dir] = { ...entry, rank: other.rank };
    setEntries(updated);
    await Promise.all([
      supabase.from("entries").update({ rank: other.rank }).eq("id", entry.id),
      supabase.from("entries").update({ rank: entry.rank }).eq("id", other.id),
    ]);
  }

  async function saveNote(entry: Entry, note: string) {
    setEntries(entries.map((e: Entry) => (e.id === entry.id ? { ...e, note } : e)));
    await supabase.from("entries").update({ note }).eq("id", entry.id);
  }

  async function removeEntry(entry: Entry) {
    if (!confirm(`Remove ${entry.name} from your list?`)) return;
    await supabase.from("entries").delete().eq("id", entry.id);
    // close the rank gap
    const remaining = entries.filter((e: Entry) => e.id !== entry.id);
    await Promise.all(
      remaining.map((e: Entry, i: number) =>
        e.rank !== i + 1 ? supabase.from("entries").update({ rank: i + 1 }).eq("id", e.id) : null
      )
    );
    reload();
  }

  /* ----- rounds ----- */
  async function addRound(entry: Entry, form: { date: string; score: string; notes: string; file: File | null }) {
    let scorecard_path: string | null = null;
    if (form.file) {
      const ext = (form.file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("scorecards").upload(path, form.file, {
        cacheControl: "31536000",
        upsert: false,
      });
      if (upErr) {
        setMsg(`Scorecard upload failed: ${upErr.message}`);
        return false;
      }
      scorecard_path = path;
    }
    const { error } = await supabase.from("rounds").insert({
      user_id: profile.id,
      entry_id: entry.id,
      played_on: form.date || null,
      score: form.score ? Number(form.score) : null,
      notes: form.notes.trim(),
      scorecard_path,
    });
    if (error) {
      setMsg(error.message);
      return false;
    }
    reload();
    return true;
  }

  async function deleteRound(r: Round) {
    if (!confirm("Delete this round?")) return;
    if (r.scorecard_path) await supabase.storage.from("scorecards").remove([r.scorecard_path]);
    await supabase.from("rounds").delete().eq("id", r.id);
    reload();
  }

  /* ----- settings / import ----- */
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/u/${profile.username}` : `/u/${profile.username}`;

  return (
    <main className="container" style={{ paddingTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>{profile.list_title}</h1>
        <span className="chip">{entries.length} / {profile.list_size}</span>
        <div className="header-spacer" />
        <a className="btn btn-small" href={`/u/${profile.username}`} target="_blank">View public page ↗</a>
        <button className="btn btn-small" onClick={() => { navigator.clipboard?.writeText(shareUrl); setMsg("Share link copied!"); }}>
          Copy share link
        </button>
        <button className="btn btn-small" onClick={() => setShowImport(!showImport)}>Import</button>
        <button className="btn btn-small" onClick={() => setShowSettings(!showSettings)}>Settings</button>
        <button className="btn btn-small" onClick={signOut}>Sign out</button>
      </div>

      {msg && <p className="success-text" style={{ marginTop: 0 }}>{msg}</p>}

      {showSettings && <Settings supabase={supabase} profile={profile} onSaved={() => { setShowSettings(false); reload(); }} />}
      {showImport && <ImportBox supabase={supabase} profile={profile} existingCount={entries.length} onDone={() => { setShowImport(false); reload(); }} />}

      <div className="list-layout">
        <div className="list-map">
          <CourseMap points={points} selectedId={selectedId} onSelect={setSelectedId} height="min(60vh, 560px)" />

          <form className="card" onSubmit={addCourse} style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <b>Add a course</b>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label className="field">Course name</label>
                <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Cypress Point Club" />
              </div>
              <div>
                <label className="field">Town / state / country</label>
                <input className="input" value={newLoc} onChange={(e) => setNewLoc(e.target.value)} placeholder="Pebble Beach, California" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-small" onClick={geocode} disabled={geoBusy}>
                {geoBusy ? "Looking up…" : "📍 Find on map"}
              </button>
              <div style={{ width: 110 }}>
                <label className="field">Lat</label>
                <input className="input" value={newLat} onChange={(e) => setNewLat(e.target.value)} placeholder="40.89" />
              </div>
              <div style={{ width: 110 }}>
                <label className="field">Lng</label>
                <input className="input" value={newLng} onChange={(e) => setNewLng(e.target.value)} placeholder="-72.44" />
              </div>
              <button className="btn btn-primary btn-small" disabled={addBusy || !newName.trim()}>
                {addBusy ? "Adding…" : `Add at #${entries.length + 1}`}
              </button>
            </div>
            <div className="small muted">
              &ldquo;Find on map&rdquo; uses OpenStreetMap search — it gets most courses; nudge the
              numbers if the pin is off. New courses land at the bottom; use the arrows to move them up.
            </div>
          </form>
        </div>

        <div className="list-pane card" style={{ padding: 0, overflow: "hidden" }}>
          {entries.map((e: Entry, i: number) => (
            <EntryRow
              key={e.id}
              entry={e}
              rounds={rounds.filter((r: Round) => r.entry_id === e.id)}
              first={i === 0}
              last={i === entries.length - 1}
              active={selectedId === e.id}
              onSelect={() => setSelectedId(e.id)}
              onMove={(dir: -1 | 1) => move(e, dir)}
              onSaveNote={(note: string) => saveNote(e, note)}
              onDelete={() => removeEntry(e)}
              onAddRound={(form: any) => addRound(e, form)}
              onDeleteRound={deleteRound}
            />
          ))}
          {entries.length === 0 && (
            <div style={{ padding: 24 }} className="muted">
              No courses yet — add your first on the left, or use Import to paste a whole list.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* ---------------- entry row ---------------- */

function EntryRow({ entry, rounds, first, last, active, onSelect, onMove, onSaveNote, onDelete, onAddRound, onDeleteRound }: any) {
  const [open, setOpen] = useState(false);
  const [noteEdit, setNoteEdit] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [score, setScore] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const best = rounds.map((r: Round) => r.score).filter((s: any) => s != null);
  const bestScore = best.length ? Math.min(...best) : null;

  return (
    <div>
      <div className={`course-row ${active ? "active" : ""}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
          <button className="btn-icon" disabled={first} onClick={() => onMove(-1)} title="Move up">↑</button>
          <div className="rank-badge">{entry.rank}</div>
          <button className="btn-icon" disabled={last} onClick={() => onMove(1)} title="Move down">↓</button>
        </div>
        <div className="course-main clickable" style={{ cursor: "pointer" }} onClick={() => { onSelect(); setOpen(!open); }}>
          <div className="course-name">{entry.name}</div>
          <div className="course-loc">{entry.location}{entry.lat == null && <span className="muted"> · no pin yet</span>}</div>
          {noteEdit === null ? (
            <div className="course-note">
              {entry.note ? `“${entry.note}”` : <span className="muted">no note yet</span>}{" "}
              <a onClick={(ev) => { ev.stopPropagation(); setNoteEdit(entry.note); }} style={{ cursor: "pointer", fontSize: 12 }}>edit</a>
            </div>
          ) : (
            <div onClick={(ev) => ev.stopPropagation()} style={{ marginTop: 6 }}>
              <textarea className="input" rows={2} value={noteEdit} onChange={(e) => setNoteEdit(e.target.value)} />
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button className="btn btn-small btn-primary" onClick={() => { onSaveNote(noteEdit); setNoteEdit(null); }}>Save note</button>
                <button className="btn btn-small" onClick={() => setNoteEdit(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          {bestScore != null && <div className="chip chip-score">best {bestScore}</div>}
          <div className="small" style={{ marginTop: 4 }}>
            <a style={{ cursor: "pointer" }} onClick={() => setOpen(!open)}>
              {rounds.length} round{rounds.length === 1 ? "" : "s"} {open ? "▾" : "▸"}
            </a>
          </div>
          <div className="small" style={{ marginTop: 4 }}>
            <a className="btn-danger" style={{ cursor: "pointer", color: "var(--danger)" }} onClick={onDelete}>remove</a>
          </div>
        </div>
      </div>

      {open && (
        <div style={{ padding: "6px 16px 16px 62px", borderBottom: "1px solid var(--border)" }}>
          {rounds.map((r: Round) => (
            <div key={r.id} className="round-row">
              {r.score != null && <span className="round-score">{r.score}</span>}
              <span className="muted">{r.played_on || "date unknown"}</span>
              {r.notes && <span>{r.notes}</span>}
              {r.scorecard_path && <ScorecardThumb path={r.scorecard_path} name={entry.name} />}
              <a style={{ cursor: "pointer", color: "var(--danger)", fontSize: 12 }} onClick={() => onDeleteRound(r)}>delete</a>
            </div>
          ))}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const ok = await onAddRound({ date, score, notes, file });
              setBusy(false);
              if (ok) { setDate(""); setScore(""); setNotes(""); setFile(null); }
            }}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 10 }}
          >
            <div style={{ width: 140 }}>
              <label className="field">Date played</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div style={{ width: 90 }}>
              <label className="field">Score</label>
              <input className="input" type="number" min={18} max={300} value={score} onChange={(e) => setScore(e.target.value)} placeholder="82" />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <label className="field">Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Birdied 18 into the wind…" />
            </div>
            <div style={{ flex: "1 1 170px" }}>
              <label className="field">Scorecard photo</label>
              <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <button className="btn btn-primary btn-small" disabled={busy}>{busy ? "Saving…" : "Log round"}</button>
          </form>
        </div>
      )}
    </div>
  );
}

function ScorecardThumb({ path, name }: { path: string; name: string }) {
  const [zoom, setZoom] = useState(false);
  const url = scorecardUrl(path);
  if (!url) return null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Scorecard from ${name}`} className="scorecard-thumb" onClick={() => setZoom(true)} />
      {zoom && (
        <div onClick={() => setZoom(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "zoom-out" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Scorecard" className="scorecard-full" style={{ maxHeight: "90vh" }} />
        </div>
      )}
    </>
  );
}

/* ---------------- settings & import ---------------- */

function Settings({ supabase, profile, onSaved }: any) {
  const [title, setTitle] = useState(profile.list_title);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [size, setSize] = useState(profile.list_size);
  const [busy, setBusy] = useState(false);
  return (
    <div className="card" style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div style={{ flex: "1 1 200px" }}>
        <label className="field">List title</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div style={{ flex: "1 1 140px" }}>
        <label className="field">Display name</label>
        <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div style={{ width: 120 }}>
        <label className="field">List cap</label>
        <select className="input" value={size} onChange={(e) => setSize(Number(e.target.value))}>
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>Top {n}</option>)}
        </select>
      </div>
      <button className="btn btn-primary btn-small" disabled={busy}
        onClick={async () => {
          setBusy(true);
          await supabase.from("profiles").update({ list_title: title, display_name: displayName, list_size: size }).eq("id", profile.id);
          setBusy(false);
          onSaved();
        }}>
        Save settings
      </button>
    </div>
  );
}

function ImportBox({ supabase, profile, existingCount, onDone }: any) {
  const [text, setText] = useState("");
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <b>Import a list</b>
      <p className="small muted" style={{ margin: "4px 0 10px" }}>
        Paste a JSON array of courses: {"[{ \"rank\": 1, \"name\": \"…\", \"location\": \"…\", \"lat\": 40.9, \"lng\": -72.4, \"note\": \"\" }, …]"}
      </p>
      <textarea className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste JSON here" />
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <label className="small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
          Replace my current list (otherwise appends)
        </label>
        {err && <span className="error-text">{err}</span>}
        <div className="header-spacer" />
        <button className="btn btn-primary btn-small" disabled={busy}
          onClick={async () => {
            setErr("");
            let items: any[];
            try {
              items = JSON.parse(text);
              if (!Array.isArray(items)) throw new Error();
            } catch {
              setErr("That doesn't look like a JSON array.");
              return;
            }
            setBusy(true);
            if (replace) await supabase.from("entries").delete().eq("user_id", profile.id);
            const base = replace ? 0 : existingCount;
            const rows = items
              .sort((a, b) => (a.rank || 999) - (b.rank || 999))
              .map((c, i) => ({
                user_id: profile.id,
                rank: base + i + 1,
                name: String(c.name || "Unnamed course"),
                location: String(c.location || ""),
                lat: c.lat != null ? Number(c.lat) : null,
                lng: c.lng != null ? Number(c.lng) : null,
                note: String(c.note || ""),
              }));
            const { error } = await supabase.from("entries").insert(rows);
            setBusy(false);
            if (error) setErr(error.message);
            else onDone();
          }}>
          {busy ? "Importing…" : "Import"}
        </button>
      </div>
    </div>
  );
}
