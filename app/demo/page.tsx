import { getServerClient, scorecardPublicUrl } from "@/lib/supabase/server";
import PublicList, { type PublicRound } from "@/components/PublicList";
import { DEMO_USERNAME } from "@/lib/config";
import type { Entry, Round } from "@/lib/types";

export const dynamic = "force-dynamic";

// /demo shows a real, live list (see DEMO_USERNAME in lib/config.ts) with the
// sign-up banner on top — so the demo is always as current as the product.
export default async function DemoPage() {
  const supabase = getServerClient();

  if (supabase) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", DEMO_USERNAME)
      .maybeSingle();

    if (profile) {
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
          ownerMeta={{
            location: profile.location,
            home_course: profile.home_course,
            handicap: profile.handicap,
          }}
          entries={(entries || []) as Entry[]}
          roundsByEntry={roundsByEntry}
          demoBanner
        />
      );
    }
  }

  // Fallback (Supabase not configured, or demo user missing): empty demo shell.
  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <div className="card" style={{ maxWidth: 460 }}>
        <b>Demo unavailable right now.</b>
        <p className="small muted">
          The live demo list could not be loaded. Sign in to start your own list instead.
        </p>
      </div>
    </main>
  );
}
