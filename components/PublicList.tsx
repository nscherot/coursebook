"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Entry, Round } from "@/lib/types";

const CourseMap = dynamic(() => import("./CourseMap"), { ssr: false });

export type PublicRound = Round & { scorecard_url: string | null };

type Props = {
  title: string;
  ownerName: string;
  entries: Entry[];
  roundsByEntry: Record<string, PublicRound[]>;
  demoBanner?: boolean;
};

export default function PublicList({ title, ownerName, entries, roundsByEntry, demoBanner }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  const points = useMemo(
    () => entries.map((e) => ({ id: e.id, rank: e.rank, name: e.name, location: e.location, lat: e.lat, lng: e.lng })),
    [entries]
  );

  const totalRounds = Object.values(roundsByEntry).reduce((n, r) => n + r.length, 0);
  const cardCount = Object.values(roundsByEntry)
    .flat()
    .filter((r) => r.scorecard_url).length;

  function bestScore(id: string): number | null {
    const scores = (roundsByEntry[id] || []).map((r) => r.score).filter((s): s is number => s != null);
    return scores.length ? Math.min(...scores) : null;
  }

  function select(id: string) {
    setSelectedId(id);
    setExpanded((x) => ({ ...x, [id]: true }));
    document.getElementById(`entry-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  return (
    <main className="container" style={{ paddingTop: 24 }}>
      {demoBanner && (
        <div className="chip" style={{ display: "inline-block", marginBottom: 12 }}>
          Demo list — sign in to build your own
        </div>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>{title}</h1>
        <span className="muted">by {ownerName}</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <span className="chip">{entries.length} courses</span>
        <span className="chip">{totalRounds} rounds logged</span>
        <span className="chip">{cardCount} scorecards</span>
      </div>

      <div className="list-layout">
        <div className="list-map">
          <CourseMap points={points} selectedId={selectedId} onSelect={select} height="100%" />
        </div>
        <div className="list-pane card" style={{ padding: 0, overflow: "hidden" }}>
          {entries.map((e) => {
            const rounds = roundsByEntry[e.id] || [];
            const best = bestScore(e.id);
            const isOpen = !!expanded[e.id];
            return (
              <div key={e.id} id={`entry-${e.id}`}>
                <div
                  className={`course-row clickable ${selectedId === e.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedId(e.id);
                    setExpanded((x) => ({ ...x, [e.id]: !isOpen }));
                  }}
                >
                  <div className={`rank-badge${e.rank === 1 ? " rank-1" : ""}`}>{e.rank}</div>
                  <div className="course-main">
                    <div className="course-name">{e.name}</div>
                    <div className="course-loc">{e.location}</div>
                    {e.note && <div className="course-note">&ldquo;{e.note}&rdquo;</div>}
                  </div>
                  <div style={{ textAlign: "right", flex: "none" }}>
                    {best != null && <div className="chip chip-score">best {best}</div>}
                    <div className="small muted" style={{ marginTop: 4 }}>
                      {rounds.length > 0 ? `${rounds.length} round${rounds.length > 1 ? "s" : ""} ${isOpen ? "▾" : "▸"}` : ""}
                    </div>
                  </div>
                </div>
                {isOpen && rounds.length > 0 && (
                  <div style={{ padding: "4px 16px 14px 60px" }}>
                    {rounds.map((r) => (
                      <div key={r.id} className="round-row">
                        {!r.played_on && r.score == null && !r.notes && !r.scorecard_url ? (
                          <span className="muted" style={{ fontStyle: "italic" }}>played</span>
                        ) : null}
                        {r.score != null && <span className="round-score">{r.score}</span>}
                        {(r.played_on || r.score != null || r.notes || r.scorecard_url) && (
                          <span className="muted">{r.played_on || "date unknown"}</span>
                        )}
                        {r.notes && <span>{r.notes}</span>}
                        {r.scorecard_url && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={r.scorecard_url}
                            alt={`Scorecard from ${e.name}`}
                            className="scorecard-thumb"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setLightbox(r.scorecard_url);
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {entries.length === 0 && (
            <div style={{ padding: 24 }} className="muted">No courses ranked yet.</div>
          )}
        </div>
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 2000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Scorecard" className="scorecard-full" style={{ maxHeight: "90vh" }} />
        </div>
      )}
    </main>
  );
}
