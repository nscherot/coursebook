import "./globals.css";
import "leaflet/dist/leaflet.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { SITE_NAME, TAGLINE } from "@/lib/config";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: TAGLINE,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { title: SITE_NAME },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#14684a" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a19" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="logo">
              ⛳ {SITE_NAME}
            </Link>
            <div className="header-spacer" />
            <Link href="/demo" className="btn btn-small">Demo</Link>
            <Link href="/edit" className="btn btn-small">My list</Link>
            <Link href="/login" className="btn btn-small btn-primary">Sign in</Link>
          </div>
        </header>
        {children}
        <footer className="footer-note">
          <div className="container">
            {SITE_NAME} — {TAGLINE} · <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/terms">Terms</Link> · Map data © OpenStreetMap contributors
          </div>
        </footer>
      </body>
    </html>
  );
}
