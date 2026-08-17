import PublicList from "@/components/PublicList";
import nate from "@/data/nate-top25.json";
import type { Entry } from "@/lib/types";

export default function DemoPage() {
  const entries: Entry[] = nate.map((c, i) => ({
    id: `demo-${i + 1}`,
    user_id: "demo",
    rank: c.rank,
    name: c.name,
    location: c.location,
    lat: c.lat,
    lng: c.lng,
    note: c.note || "",
  }));

  return (
    <PublicList
      title="Nate's Top 25 Golf Courses"
      ownerName="Nate"
      entries={entries}
      roundsByEntry={{}}
      demoBanner
    />
  );
}
