"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getBrowserClient, scorecardUrl } from "@/lib/supabase/client";
import { SITE_NAME } from "@/lib/config";
import type { Entry, Profile, Round } from "@/lib/types";

const CourseMap = dynamic(() => import("@/components/CourseMap"), { ssr: false });
import PasteImport from "@/components/PasteImport";

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
  const [dbResults, setDbResults] = useState<any[] | null>(null);
  const [dbBusy, setDbBusy] = useState(false);
  const [dbConfigured, setDbConfigured] = useState(true);
  const [dbOpen, setDbOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);
  const searchCache = useRef<Record<string, any[]>>({});

  async function geocodeQuery(q: string): Promise<{ lat: string; lng: string; label: string } | null> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
      );
      const results = await res.json();
      if (results.length > 0) {
        return {
          lat: Number(results[0].lat).toFixed(5),
          lng: Number(results[0].lon).toFixed(5),
          label: results[0].display_name,
        };
      }
    } catch {
      /* fall through */
    }
    return null;
  }

  async function geocode() {
    const q = `${newName} ${newLoc}`.trim();
    if (!q) return;
    setGeoBusy(true);
    setMsg("");
    const hit = await geocodeQuery(q);
    if (hit) {
      setNewLat(hit.lat);
      setNewLng(hit.lng);
      setMsg(`Pinned near: ${hit.label}`);
    } else {
      setMsg("No match found — try adding the town/state, or type coordinates manually.");
    }
    setGeoBusy(false);
  }

  // Debounced type-ahead: fires only after a typing pause, ≥4 chars,
  // with per-session caching and stale-response protection (quota-friendly).
  function onNameChange(value: string) {
    setNewName(value);
    if (!dbConfigured) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = value.trim().toLowerCase();
    if (q.length < 4) {
      setDbOpen(false);
      setDbResults(null);
      return;
    }
    if (searchCache.current[q]) {
      setDbResults(searchCache.current[q]);
      setDbOpen(true);
      return;
    }
    setDbBusy(true);
    setDbOpen(true);
    searchTimer.current = setTimeout(() => runSearch(q), 550);
  }

  async function runSearch(q: string) {
    const seq = ++searchSeq.current;
    try {
      const res = await fetch(`/api/courses/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (seq !== searchSeq.current) return; // a newer search superseded this one
      if (!data.configured) {
        setDbConfigured(false);
        setDbOpen(false);
        setMsg("Course database isn't connected (no API key) — add courses manually with Find on map.");
      } else if (data.error) {
        setDbOpen(false);
        setMsg(`${data.error} — you can still add the course manually.`);
      } else {
        searchCache.current[q] = data.courses;
        setDbResults(data.courses);
        setDbOpen(true);
      }
    } catch {
      if (seq === searchSeq.current) setDbOpen(false);
    }
    if (seq === searchSeq.current) setDbBusy(false);
  }

  async function pickDbCourse(c: any) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchSeq.current++; // invalidate any in-flight search
    setNewName(c.name);
    setNewLoc(c.location || "");
    setDbResults(null);
    setDbOpen(false);
    setDbBusy(false);
    if (c.lat != null && c.lng != null) {
      setNewLat(String(c.lat));
      setNewLng(String(c.lng));
      setMsg(`Selected ${c.name} — pin set from the course database.`);
      return;
    }
    // No coordinates from the API: geocode for the map pin, trying several phrasings.
    // A course-name match is only trusted if it lands near the course's town —
    // otherwise a same-named course elsewhere could hijack the pin.
    setGeoBusy(true);
    const baseName = c.name.replace(/\s*\(.*\)$/, ""); // "Club (Course No. 1)" -> "Club"
    const town = (c.location || "").split(",")[0].trim();
    const townHit = c.location ? await geocodeQuery(c.location) : null;
    const nearTown = (h: { lat: string; lng: string }) =>
      !townHit ||
      (Math.abs(Number(h.lat) - Number(townHit.lat)) < 1.0 &&
        Math.abs(Number(h.lng) - Number(townHit.lng)) < 1.0);
    const candidates = [
      c.address,
      `${baseName}, ${c.location || ""}`,
      town ? `${baseName}, ${town}` : "",
      baseName,
    ].filter((s: string | undefined) => s && s.trim().length > 3);
    let hit: { lat: string; lng: string; label: string } | null = null;
    for (const q of candidates) {
      const h = await geocodeQuery(q as string);
      if (h && nearTown(h)) { hit = h; break; }
    }
    if (!hit && townHit) {
      hit = { ...townHit, label: `${townHit.label} (town center — nudge the pin if needed)` };
    }
    if (hit) {
      setNewLat(hit.lat);
      setNewLng(hit.lng);
      setMsg(`Selected ${c.name} — pinned near ${hit.label}`);
    } else {
      setMsg(`Selected ${c.name} — couldn't find map coordinates automatically; use Find on map or type them.`);
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
    const { data: created, error } = await supabase
      .from("entries")
      .insert({
        user_id: profile.id,
        rank: entries.length + 1,
        name: newName.trim(),
        location: newLoc.trim(),
        lat: newLat ? Number(newLat) : null,
        lng: newLng ? Number(newLng) : null,
        note: "",
      })
      .select("id")
      .single();
    // Being on the list means you've played it — start every course with one round.
    if (!error && created) {
      await supabase.from("rounds").insert({ user_id: profile.id, entry_id: created.id, notes: "" });
    }
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
  // iPhone photos are often HEIC (even when renamed .png/.jpg) — browsers can't
  // display those, so sniff the real format and convert to JPEG when needed.
  async function normalizePhoto(file: File): Promise<{ blob: Blob; ext: string; converted: boolean } | null> {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const sig = String.fromCharCode.apply(null, Array.from(head.slice(4, 12)));
    const isHeic = /ftyp(heic|heix|hevc|heim|heis|hevm|hevs|mif1|msf1)/.test("ftyp" + sig.slice(4));
    if (!isHeic) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      return { blob: file, ext: ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? ext : "jpg", converted: false };
    }
    try {
      const heic2any = (await import("heic2any")).default;
      const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      return { blob: Array.isArray(out) ? out[0] : (out as Blob), ext: "jpg", converted: true };
    } catch {
      return null;
    }
  }

  function isBlankRound(r: Round) {
    return !r.played_on && r.score == null && !r.notes && !r.scorecard_path;
  }

  async function addRound(entry: Entry, form: { date: string; score: string; notes: string; file: File | null }) {
    let scorecard_path: string | null = null;
    if (form.file) {
      const photo = await normalizePhoto(form.file);
      if (!photo) {
        setMsg("Couldn't read that photo — it may be an iPhone HEIC file. Open it in Preview and use File → Export → JPEG, then upload that.");
        return false;
      }
      if (photo.converted) setMsg("Converted your iPhone photo to JPEG automatically.");
      const path = `${profile.id}/${crypto.randomUUID()}.${photo.ext}`;
      const { error: upErr } = await supabase.storage.from("scorecards").upload(path, photo.blob, {
        cacheControl: "31536000",
        upsert: false,
        contentType: photo.ext === "png" ? "image/png" : photo.ext === "webp" ? "image/webp" : photo.ext === "gif" ? "image/gif" : "image/jpeg",
      });
      if (upErr) {
        setMsg(`Scorecard upload failed: ${upErr.message}`);
        return false;
      }
      scorecard_path = path;
    }
    // If this course only has its auto-created "played" round with no details,
    // fill that one in instead of stacking a second round.
    const entryRounds = rounds.filter((r: Round) => r.entry_id === entry.id);
    const blank = entryRounds.length === 1 && isBlankRound(entryRounds[0]) ? entryRounds[0] : null;
    const values = {
      played_on: form.date || null,
      score: form.score ? Number(form.score) : null,
      notes: form.notes.trim(),
      scorecard_path,
    };
    const { error } = blank
      ? await supabase.from("rounds").update(values).eq("id", blank.id)
      : await supabase.from("rounds").insert({ user_id: profile.id, entry_id: entry.id, ...values });
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

  // Build the 1080x1920 Instagram-Story card for a round and hand it to the
  // native share sheet (phone) or download it (desktop).
  async function shareRound(entry: Entry, r: Round) {
    try {
      setMsg("Building your story card…");
      const { renderStoryCard } = await import("@/lib/storyCard");
      const blob = await renderStoryCard({
        rank: entry.rank,
        listTitle: profile.list_title,
        courseName: entry.name,
        location: entry.location,
        playedOn: r.played_on,
        score: r.score,
        photoUrl: scorecardUrl(r.scorecard_path),
        siteName: SITE_NAME,
      });
      const file = new File([blob], "coursebook-story.png", { type: "image/png" });
      const nav: any = navigator;
      const downloadIt = () => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "coursebook-story.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setMsg("Story card downloaded — AirDrop it to your phone or post from IG on desktop.");
      };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: `${entry.name} — ${SITE_NAME}` });
          setMsg("");
        } catch (e: any) {
          if (e?.name === "AbortError") setMsg("");
          else downloadIt(); // share sheet refused (e.g. lost user-gesture) — fall back
        }
      } else {
        downloadIt();
      }
    } catch {
      setMsg("Couldn't build the share card — try again.");
    }
  }

  /* ----- settings / import ----- */
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/u/${profile.username}` : `/u/${profile.username}`;

  return (
    <main className="container" style={{ paddingTop: 24 }}>
      <div className="action-bar">
        <h1 style={{ fontSize: 28, margin: 0 }}>{profile.list_title}</h1>
        <span className="chip">{entries.length} / {profile.list_size}</span>
      </div>
      <div className="action-strip">
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
      {showImport && (
        <div style={{ marginBottom: 16 }}>
          <PasteImport
            supabase={supabase}
            profile={profile}
            existingCount={entries.length}
            onDone={() => { setShowImport(false); reload(); }}
          />
        </div>
      )}

      <div className="list-layout">
        <div className="list-map">
          <div className="edit-map-wrap">
            <CourseMap points={points} selectedId={selectedId} onSelect={setSelectedId} height="min(60vh, 560px)" />
          </div>

          <form className="card" onSubmit={addCourse} style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <b>Add a course</b>
            <div className="form-grid">
              <div style={{ position: "relative" }}>
                <label className="field">Course name</label>
                <input
                  className="input"
                  value={newName}
                  onChange={(e) => onNameChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (dbOpen && dbResults && dbResults.length > 0) pickDbCourse(dbResults[0]);
                    }
                    if (e.key === "Escape") setDbOpen(false);
                  }}
                  onFocus={() => { if (dbResults && dbResults.length > 0 && newName.trim().length >= 4) setDbOpen(true); }}
                  onBlur={() => setTimeout(() => setDbOpen(false), 200)}
                  placeholder={dbConfigured ? "Start typing — e.g. cypress…" : "Cypress Point Club"}
                  autoComplete="off"
                />
                {dbOpen && (
                  <div
                    style={{
                      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 60,
                      marginTop: 4, background: "var(--surface)", border: "1px solid var(--border)",
                      borderRadius: 10, boxShadow: "var(--shadow)", maxHeight: 300, overflowY: "auto",
                    }}
                  >
                    {dbBusy && (
                      <div className="small muted" style={{ padding: "10px 14px" }}>Searching 30,000 courses…</div>
                    )}
                    {!dbBusy && dbResults && dbResults.length === 0 && (
                      <div className="small muted" style={{ padding: "10px 14px" }}>
                        No matches — fill in the town and use 📍 Find on map instead.
                      </div>
                    )}
                    {!dbBusy && dbResults && dbResults.map((c: any, i: number) => (
                      <div
                        key={c.id ?? i}
                        className="course-row clickable"
                        style={{ padding: "9px 14px", borderBottom: i === dbResults.length - 1 ? "none" : undefined }}
                        onMouseDown={(e) => { e.preventDefault(); pickDbCourse(c); }}
                      >
                        <div className="course-main">
                          <div className="course-name" style={{ fontSize: 14 }}>{c.name}</div>
                          <div className="course-loc">{c.location || c.address || ""}</div>
                        </div>
                        {i === 0 && <span className="small muted" style={{ flex: "none" }}>↵</span>}
                      </div>
                    ))}
                  </div>
                )}
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
              {dbConfigured
                ? "Start typing a course name (4+ letters) and pick from the dropdown — even partial or misspelled names match, and the location and map pin fill in automatically. "
                : "“Find on map” uses OpenStreetMap search — it gets most courses; nudge the numbers if the pin is off. "}
              New courses land at the bottom; use the arrows to move them up.
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
              onShareRound={(r: Round) => shareRound(e, r)}
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

function EntryRow({ entry, rounds, first, last, active, onSelect, onMove, onSaveNote, onDelete, onAddRound, onDeleteRound, onShareRound }: any) {
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
              <a className="rowlink" onClick={(ev) => { ev.stopPropagation(); setNoteEdit(entry.note); }}>edit</a>
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
            <a className="rowlink" onClick={() => setOpen(!open)}>
              {rounds.length} round{rounds.length === 1 ? "" : "s"} {open ? "▾" : "▸"}
            </a>
          </div>
          <div className="small" style={{ marginTop: 4 }}>
            <a className="rowlink" style={{ color: "var(--danger)" }} onClick={onDelete}>remove</a>
          </div>
        </div>
      </div>

      {open && (
        <div style={{ padding: "6px 16px 16px 62px", borderBottom: "1px solid var(--border)" }}>
          {rounds.map((r: Round) => {
            const blank = !r.played_on && r.score == null && !r.notes && !r.scorecard_path;
            return (
              <div key={r.id} className="round-row">
                {blank ? (
                  <span className="muted" style={{ fontStyle: "italic" }}>played — add the date, score, or scorecard below</span>
                ) : (
                  <>
                    {r.score != null && <span className="round-score">{r.score}</span>}
                    <span className="muted">{r.played_on || "date unknown"}</span>
                    {r.notes && <span>{r.notes}</span>}
                    {r.scorecard_path && <ScorecardThumb path={r.scorecard_path} name={entry.name} />}
                  </>
                )}
                <a className="rowlink" style={{ color: "var(--accent)", fontWeight: 600 }} onClick={() => onShareRound(r)}>📸 share</a>
                <a className="rowlink" style={{ color: "var(--danger)" }} onClick={() => onDeleteRound(r)}>delete</a>
              </div>
            );
          })}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const ok = await onAddRound({ date, score, notes, file });
              setBusy(false);
              if (ok) { setDate(""); setScore(""); setNotes(""); setFile(null); }
            }}
            className="round-form"
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
              <input className="input" type="file" accept="image/*,.heic,.heif" onChange={(e) => setFile(e.target.files?.[0] || null)} />
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
