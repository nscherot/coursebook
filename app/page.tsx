import Link from "next/link";
import { SITE_NAME, TAGLINE } from "@/lib/config";

export default function Home() {
  return (
    <main className="container" style={{ paddingTop: 56, paddingBottom: 40 }}>
      <div style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 40, margin: "0 0 12px" }}>
          Your courses. Your ranks. <span style={{ color: "var(--accent)" }}>Your cards.</span>
        </h1>
        <p style={{ fontSize: 17, color: "var(--text-secondary)", margin: "0 0 8px" }}>
          {SITE_NAME} is where golfers keep their own ranked list of every great course
          they&rsquo;ve played — on an interactive map, with the scores they actually shot
          and photos of the scorecards to prove it.
        </p>
        <p className="muted" style={{ margin: "0 0 28px" }}>
          Not a critics&rsquo; list. Yours.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/login" className="btn btn-primary">Start your list</Link>
          <Link href="/demo" className="btn">See a real top 25</Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 56 }}>
        {[
          ["🗺️", "Map every round", "Every course you rank gets a numbered pin on your personal world map."],
          ["🏌️", "Rank what you played", "Top 10, 25, or 100 — your list, your order, with a note for every course."],
          ["✍️", "Post the proof", "Log each round with the date and score, and upload a photo of the scorecard."],
          ["🔗", "Share it", "Every list gets a public page you can send to your group chat."],
        ].map(([icon, title, body]) => (
          <div key={title} className="card" style={{ flex: "1 1 220px" }}>
            <div style={{ fontSize: 26 }}>{icon}</div>
            <div style={{ fontWeight: 700, margin: "8px 0 4px" }}>{title}</div>
            <div className="small" style={{ color: "var(--text-secondary)" }}>{body}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
