import { notFound } from "next/navigation";
import { getServerClient, scorecardPublicUrl } from "@/lib/supabase/server";
import PublicList, { type PublicRound } from "@/components/PublicList";
import type { Entry, Round } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UserPage({ params }: { params: { username: string } }) {
  const supabase = getServerClient();
  if (!supabase) {
    return (
      <main className="container" style={{ paddingTop: 48 }}>
        <div className="card" style={{ maxWidth: 460 }}>
          <b>Not connected yet.</b>
          <p className="small muted">Set up Supabase first (see SETUP.md), then user pages go live.</p>
        </div>
      </main>
    );
  }

  const username = params.username.toLowerCase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, list_title, list_size")
    .eq("username", username)
    .maybeSingle();
  if (!profile) notFound();

  const { data: entries } = await supabase
    .from("entries")
    .select("*")
    .eq("user_id", profile.id)
    .order("rank", { ascending: true });

  const { data: rounds } = await supabase
    .from("rounds")
    .select("*")
    .eq("user_id", profile.id)
    .order("played_on", { ascending: false });

  const roundsByEntry: Record<string, PublicRound[]> = {};
  (rounds || []).forEach((r: Round) => {
    (roundsByEntry[r.entry_id] ||= []).push({
      ...r,
      scorecard_url: scorecardPublicUrl(r.scorecard_path),
    });
  });

  return (
    <PublicList
      title={profile.list_title}
      ownerName={profile.display_name || profile.username}
      entries={(entries || []) as Entry[]}
      roundsByEntry={roundsByEntry}
    />
  );
}
