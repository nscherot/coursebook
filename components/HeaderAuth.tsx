"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";

/**
 * Right side of the site header. Shows Sign in for visitors; My list,
 * Profile and Sign out once authenticated.
 */
export default function HeaderAuth() {
  const supabase = getBrowserClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) {
      setSignedIn(false);
      return;
    }
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setSignedIn(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setSignedIn(!!session?.user);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.assign("/");
  }

  if (signedIn) {
    return (
      <>
        <Link href="/edit" className="btn btn-small btn-primary">My list</Link>
        <Link href="/profile" className="btn btn-small">Profile</Link>
        <button type="button" className="btn btn-small" onClick={signOut}>
          Sign out
        </button>
      </>
    );
  }

  // Signed out (and the brief loading moment before we know).
  return (
    <>
      <Link href="/edit" className="btn btn-small">My list</Link>
      <Link href="/login" className="btn btn-small btn-primary">Sign in</Link>
    </>
  );
}
