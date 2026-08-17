import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = getServerClient();
  if (!supabase) return NextResponse.redirect(`${origin}/login`);

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }
  if (!ok) return NextResponse.redirect(`${origin}/login`);

  // Send new users to onboarding, returning users to their list.
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile) return NextResponse.redirect(`${origin}/onboarding`);
  }
  return NextResponse.redirect(`${origin}/edit`);
}
