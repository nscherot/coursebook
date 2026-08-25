"use client";
import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCourseList, type ParsedCourse } from "@/lib/importParse";

type DbMatch = { id: string | null; name: string; location: string; address: string };

type Row = ParsedCourse & {
  include: boolean;
  match: DbMatch | null;       // chosen match (null = keep as typed)
  alternatives: DbMatch[];     // other candidates from the search
  lat: number | null;
  lng: number | null;
};

type Props = {
  supabase: SupabaseClient;
  profile: { id: string; list_size: number };
  existingCount: number;
  onDone: () => void;
  onSkip?: () => void; // present in onboarding: renders a skip link
};

const geocodeCache: Record<string, { lat: number; lng: number } | null> = {};

async function geocodeTown(q: string): Promise<{ lat: number; lng: number } | null> {
  const key = q.trim().toLowerCase();
  if (!key) return null;
  if (key in geocodeCache) return geocodeCache[key];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
    );
    const results = await res.json();
    geocodeCache[key] =
      results.length > 0
        ? { lat: Number(Number(results[0].lat).toFixed(5)), lng: Number(Number(results[0].lon).toFixed(5)) }
        : null;
  } catch {
    geocodeCache[key] = null;
  }
  return geocodeCache[key];
}

export default function PasteImport({ supabase, profile, existingCount, onDone, onSkip }: Props) {
  const [step, setStep] = useState<"paste" | "matching" | "review" | "importing">("paste");
  const [text, setText] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [rows, setRows] = useState<Row[]>([]);
  const [replace, setReplace] = useState(false);
  const [err, setErr] = useState("");
  const cancelled = useRef(false);

  async function startMatching() {
    setErr("");
    const parsed = parseCourseList(text);
    if (parsed.length === 0) {
      setErr("Couldn't find any course names in that — try pasting one course per line.");
      return;
    }
    cancelled.current = false;
    setStep("matching");
    setProgress({ done: 0, total: parsed.length });

    const built: Row[] = [];
    for (let i = 0; i < parsed.length; i++) {
      if (cancelled.current) return;
      const p = parsed[i];
      let match: DbMatch | null = null;
      let alternatives: DbMatch[] = [];
      try {
        const res = await fetch(`/api/courses/search?q=${encodeURIComponent(p.name)}`);
        const data = await res.json();
        if (data?.courses?.length) {
          const candidates: DbMatch[] = data.courses;
          // If the pasted line had a location, prefer a candidate that mentions part of it.
          const locToken = p.location.split(",")[0].trim().toLowerCase();
          const preferred =
            locToken.length > 2
              ? candidates.find((c) => c.location.toLowerCase().includes(locToken))
              : null;
          match = preferred || candidates[0];
          alternatives = candidates.filter((c) => c !== match).slice(0, 5);
        }
      } catch {
        /* leave unmatched */
      }
      // Pin: town center of the best location we know (match's town beats pasted text).
      const town = (match ? match.location : "") || p.location;
      const pin = town ? await geocodeTown(town) : null;
      built.push({
        ...p,
        include: true,
        match,
        alternatives,
        lat: pin?.lat ?? null,
        lng: pin?.lng ?? null,
      });
      setProgress({ done: i + 1, total: parsed.length });
    }
    setRows(built);
    setStep("review");
  }

  async function chooseMatch(idx: number, m: DbMatch | null) {
    const next = [...rows];
    const row = { ...next[idx], match: m };
    const town = (m ? m.location : "") || row.location;
    const pin = town ? await geocodeTown(town) : null;
    row.lat = pin?.lat ?? null;
    row.lng = pin?.lng ?? null;
    next[idx] = row;
    setRows(next);
  }

  async function runImport() {
    const chosen = rows.filter((r) => r.include);
    if (chosen.length === 0) return;
    setStep("importing");
    setErr("");
    try {
      if (replace) {
        await supabase.from("entries").delete().eq("user_id", profile.id);
      }
      const base = replace ? 0 : existingCount;
      const room = Math.max(0, profile.list_size - base);
      const toInsert = chosen.slice(0, room);

      const entryRows = toInsert.map((r, i) => ({
        user_id: profile.id,
        rank: base + i + 1,
        name: r.match ? r.match.name : r.name,
        location: r.match ? r.match.location : r.location,
        lat: r.lat,
        lng: r.lng,
        note: r.note,
      }));
      const { data: created, error } = await supabase.from("entries").insert(entryRows).select("id");
      if (error) throw error;

      // Every imported course counts as played — starter round, with score if we found one.
      if (created && created.length > 0) {
        await supabase.from("rounds").insert(
          created.map((row: { id: string }, i: number) => ({
            user_id: profile.id,
            entry_id: row.id,
            score: toInsert[i]?.score ?? null,
            notes: "",
          }))
        );
      }
      if (chosen.length > room) {
        // Imported what fit; the caller's page will show the cap message naturally.
      }
      onDone();
    } catch (e: any) {
      setErr(e?.message || "Import failed — nothing was saved. Try again.");
      setStep("review");
    }
  }

  /* ---------------- render ---------------- */

  if (step === "paste" || step === "matching") {
    const matching = step === "matching";
    return (
      <div className="card">
        <b>Bring your list with you</b>
        <p className="small muted" style={{ margin: "4px 0 10px" }}>
          Paste your top-courses list from anywhere — the Notes app, a Google Sheet, a text
          to your buddies. Numbered or not. We&rsquo;ll match each line against 30,000 courses.
        </p>
        <textarea
          className="input"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"1. Pebble Beach — unreal back nine\n2. Pinehurst No. 2\n3. Whistling Straits\n…"}
          disabled={matching}
        />
        {err && <p className="error-text" style={{ marginBottom: 0 }}>{err}</p>}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <button
            className="btn btn-primary btn-small"
            onClick={startMatching}
            disabled={matching || text.trim().length < 3}
          >
            {matching ? `Matching ${progress.done} of ${progress.total}…` : "Find my courses"}
          </button>
          {matching && (
            <button className="btn btn-small" onClick={() => { cancelled.current = true; setStep("paste"); }}>
              Cancel
            </button>
          )}
          <div className="header-spacer" />
          {onSkip && !matching && (
            <a onClick={onSkip} style={{ cursor: "pointer" }} className="small">
              Skip — I&rsquo;ll add courses one at a time →
            </a>
          )}
        </div>
      </div>
    );
  }

  const included = rows.filter((r) => r.include).length;
  const room = Math.max(0, profile.list_size - (replace ? 0 : existingCount));

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 10px" }}>
        <b>Check the matches</b>
        <p className="small muted" style={{ margin: "4px 0 0" }}>
          {rows.filter((r) => r.match).length} of {rows.length} matched to the course database.
          Fix anything that looks off, untick what you don&rsquo;t want, then import.
        </p>
      </div>

      <div style={{ maxHeight: 420, overflowY: "auto", borderTop: "1px solid var(--border)" }}>
        {rows.map((r, i) => (
          <div key={i} className="course-row" style={{ alignItems: "center" }}>
            <input
              type="checkbox"
              checked={r.include}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...r, include: e.target.checked };
                setRows(next);
              }}
              style={{ flex: "none" }}
            />
            <div className="rank-badge" style={{ opacity: r.include ? 1 : 0.35 }}>{i + 1}</div>
            <div className="course-main" style={{ opacity: r.include ? 1 : 0.45 }}>
              {r.match ? (
                <>
                  <div className="course-name" style={{ fontSize: 14 }}>
                    {r.match.name} <span style={{ color: "var(--accent)" }}>✓</span>
                  </div>
                  <div className="course-loc">{r.match.location}</div>
                </>
              ) : (
                <>
                  <div className="course-name" style={{ fontSize: 14 }}>
                    {r.name} <span className="muted small">(as typed — no database match)</span>
                  </div>
                  <div className="course-loc">{r.location || (r.lat ? "" : "no map pin yet")}</div>
                </>
              )}
              {(r.alternatives.length > 0 || r.match) && (
                <select
                  className="input"
                  style={{ marginTop: 4, fontSize: 12, padding: "3px 8px", width: "auto", maxWidth: "100%" }}
                  value={r.match ? "m" : "t"}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "t") chooseMatch(i, null);
                    else if (v === "m") { /* current */ }
                    else chooseMatch(i, r.alternatives[Number(v)]);
                  }}
                >
                  {r.match && <option value="m">{r.match.name} — {r.match.location}</option>}
                  {r.alternatives.map((a, ai) => (
                    <option key={ai} value={ai}>{a.name} — {a.location}</option>
                  ))}
                  <option value="t">Keep as I typed it: “{r.name}”</option>
                </select>
              )}
              {r.note && <div className="course-note">“{r.note}”</div>}
            </div>
            <div style={{ textAlign: "right", flex: "none" }}>
              {r.score != null && <span className="chip chip-score">shot {r.score}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {existingCount > 0 && (
          <label className="small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            Replace my current list (otherwise adds below it)
          </label>
        )}
        {included > room && (
          <span className="small error-text">
            Only room for {room} more (your cap is Top {profile.list_size}) — the first {room} will import.
          </span>
        )}
        {err && <span className="error-text small">{err}</span>}
        <div className="header-spacer" />
        <button className="btn btn-small" onClick={() => setStep("paste")}>← Back</button>
        <button
          className="btn btn-primary btn-small"
          onClick={runImport}
          disabled={step === "importing" || included === 0}
        >
          {step === "importing" ? "Importing…" : `Add ${Math.min(included, room)} course${Math.min(included, room) === 1 ? "" : "s"} to my list`}
        </button>
      </div>
    </div>
  );
}
