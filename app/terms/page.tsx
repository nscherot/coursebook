import { SITE_NAME } from "@/lib/config";

export const metadata = { title: `Terms — ${SITE_NAME}` };

export default function TermsPage() {
  return (
    <main className="container" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div style={{ maxWidth: 720 }}>
        <h1>Terms of Service</h1>
        <p className="muted small">Last updated: August 27, 2026</p>

        <p>
          Welcome to {SITE_NAME}. By using the site you agree to these terms — they&rsquo;re
          short and reasonable.
        </p>

        <h3>Your content</h3>
        <p>
          Everything you add — rankings, commentary, scores, and photos — belongs to you.
          By posting it you give us permission to store it and display it on your list
          pages, which is the whole point of the app. Only upload photos you took or have
          the right to share, and keep content appropriate for a general audience.
        </p>

        <h3>Your account</h3>
        <p>
          Keep access to your email or Google account secure, since that&rsquo;s how you
          sign in. We may remove content or accounts that abuse the service (spam,
          unlawful content, or attempts to break the site).
        </p>

        <h3>The service</h3>
        <p>
          {SITE_NAME} is provided as-is, free of charge, without warranties of any kind.
          We do our best to keep the site fast and your data safe, but we can&rsquo;t
          guarantee uninterrupted service, and we&rsquo;re not liable for lost data or
          damages arising from use of the site. We may update these terms as the product
          evolves; continued use means you accept the current version.
        </p>

        <h3>Questions</h3>
        <p>
          Contact <a href="mailto:nathan.scherotter@gmail.com">nathan.scherotter@gmail.com</a>.
        </p>
      </div>
    </main>
  );
}
