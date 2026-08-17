import "./globals.css";
import "leaflet/dist/leaflet.css";
import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, TAGLINE } from "@/lib/config";

export const metadata: Metadata = {
  title: SITE_NAME,
  description: TAGLINE,
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
            {SITE_NAME} — {TAGLINE} · Map data © OpenStreetMap contributors, © CARTO
          </div>
        </footer>
      </body>
    </html>
  );
}
