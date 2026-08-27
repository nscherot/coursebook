import { SITE_NAME } from "@/lib/config";

export const metadata = { title: `Privacy — ${SITE_NAME}` };

export default function PrivacyPage() {
  return (
    <main className="container" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div style={{ maxWidth: 720 }}>
        <h1>Privacy Policy</h1>
        <p className="muted small">Last updated: August 27, 2026</p>

        <p>
          {SITE_NAME} is a simple app for golfers to keep a ranked list of the courses
          they&rsquo;ve played. This policy explains what we collect and how we use it, in
          plain language.
        </p>

        <h3>What we collect</h3>
        <p>
          When you create an account we store your email address. If you sign in with
          Google, we receive your email address and basic profile information (your name)
          from Google — nothing else. The content you add — your course list, rankings,
          notes, round dates, scores, and scorecard photos — is stored so the app can show
          it back to you and on your public list page.
        </p>

        <h3>What&rsquo;s public</h3>
        <p>
          Your ranked course list, course commentary, round details, and scorecard photos
          appear on your public list page, which anyone with the link can view. Your email
          address is never shown publicly.
        </p>

        <h3>How we use your information</h3>
        <p>
          We use your email to sign you in and to send sign-in links. We use your content
          to run the product. We don&rsquo;t sell your data, and we don&rsquo;t share it
          with third parties except the services that host the app (Vercel for the website
          and Supabase for the database and photo storage).
        </p>

        <h3>Cookies</h3>
        <p>
          We use cookies only to keep you signed in. No advertising or tracking cookies.
        </p>

        <h3>Deleting your data</h3>
        <p>
          You can remove courses, rounds, and photos yourself at any time from your list.
          To delete your account and everything in it, email{" "}
          <a href="mailto:nathan.scherotter@gmail.com">nathan.scherotter@gmail.com</a> and
          we&rsquo;ll take care of it.
        </p>

        <h3>Questions</h3>
        <p>
          Contact <a href="mailto:nathan.scherotter@gmail.com">nathan.scherotter@gmail.com</a>.
        </p>
      </div>
    </main>
  );
}
