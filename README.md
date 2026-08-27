# Loop Rank

Rank the courses you've played. Prove it with the card.

A web app where golfers sign in, build a ranked list of the top courses they've
played (top 10/25/50/100), see them as numbered pins on an interactive map, log
every round with the score they shot, and upload photos of their scorecards.
Every list gets a public, shareable page.

**Unlike critics' rankings (top100golfcourses.com etc.), this is personal:
your list, your order, your scores, your scorecards.**

## Stack

- Next.js 14 (App Router) — the website, deployed on Vercel
- Supabase — sign-in (email magic links), Postgres database, scorecard image storage
- Leaflet + OpenStreetMap/CARTO — the interactive maps
- No other services; runs entirely on free tiers

## Getting it live

See **SETUP.md** — three free accounts, ~30 minutes, no coding.

## Project layout

- `app/` — pages: landing, login, onboarding, `edit` (your list builder), `u/[username]` (public pages), `demo`
- `components/CourseMap.tsx` — the Leaflet map with numbered rank pins
- `components/PublicList.tsx` — the shared public list + map + scorecards view
- `supabase/schema.sql` — database tables, security rules, storage bucket (run once in Supabase)
- `data/nate-top25.json` — starter list, importable from the edit page
- `lib/config.ts` — site name + tagline (rename the product here)

## Local development

```
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

Without env vars the app still runs: landing and `/demo` work; sign-in and
lists show a "not connected" notice.
