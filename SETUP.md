# Putting Coursebook live — step by step

You'll create three free accounts (GitHub, Supabase, Vercel). No coding needed; total time is about 30 minutes. When you're done you'll have a real website with sign-in, and it costs $0 on the free tiers.

**What each piece does:** GitHub stores the code. Supabase is the database — it handles sign-ins, everyone's lists, and scorecard photos. Vercel runs the website itself.

## Step 1 — Put the code on GitHub

1. Go to github.com and sign up (free).
2. Click the **+** in the top right → **New repository**. Name it `coursebook`, keep it **Private**, click **Create repository**.
3. On the new repo page, click the link that says **uploading an existing file**.
4. Unzip the `coursebook.zip` you got from Claude, then drag **the contents** of the coursebook folder (not the folder itself) into the upload area. Wait for all files to list, then click **Commit changes**.

## Step 2 — Create the database (Supabase)

1. Go to supabase.com → **Start your project** → sign up (free).
2. Click **New project**. Name: `coursebook`. Pick the region closest to you (e.g. *East US*). It will generate a database password — you won't need it day-to-day, but save it somewhere.
3. Wait a minute or two while the project provisions.
4. In the left sidebar, open **SQL Editor** → **New query**. Open the file `supabase/schema.sql` from the project, paste its entire contents in, and click **Run**. You should see "Success. No rows returned." This creates the tables, the security rules, and the scorecard photo storage.
5. Go to **Project Settings** (gear icon) → **API**. Keep this tab open — you'll need two values in the next step:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string under "Project API keys")

## Step 3 — Launch the website (Vercel)

1. Go to vercel.com → sign up → choose **Continue with GitHub** (this links the two accounts).
2. Click **Add New… → Project**. You'll see your `coursebook` repo — click **Import**.
3. It auto-detects Next.js. Before deploying, expand **Environment Variables** and add both of these (from the Supabase tab you kept open):
   - Name: `NEXT_PUBLIC_SUPABASE_URL` → Value: your Project URL
   - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Value: the anon public key
4. Click **Deploy**. In about a minute you'll get your live URL, like `https://coursebook-xyz.vercel.app`.

## Step 4 — Tell Supabase your website's address

This makes the emailed sign-in links point to your real site.

1. Back in Supabase: **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel URL (e.g. `https://coursebook-xyz.vercel.app`).
3. Under **Redirect URLs**, add: `https://coursebook-xyz.vercel.app/auth/callback`

## Step 5 — Sign in and import your top 25

1. Visit your site → **Sign in** → enter your email → click the link that arrives.
2. Pick your username (e.g. `nate`), display name, and list title.
3. On your list page, click **Import**, and paste the contents of `data/nate-top25.json` (also sent to you as a separate file). Your 25 courses appear, mapped and ranked.
4. Click any course → **Log round** to add a date, score, and scorecard photo.
5. **Copy share link** and send your page to anyone — theirs is one sign-up away.

## Good to know

- **Sign-in email limits:** Supabase's built-in email sender is limited to roughly 2–4 emails per hour — fine for you and early testers. Before inviting lots of people, add a custom SMTP sender (Supabase: Authentication → Emails → SMTP settings; Resend.com has a free tier) — ask Claude to walk you through it.
- **Renaming the site:** the name and tagline live in `lib/config.ts`. Edit that file on GitHub (pencil icon), commit, and Vercel redeploys automatically.
- **A custom domain** (like coursebook.golf) can be attached later in Vercel → Settings → Domains for the cost of the domain itself.
- **Updating the code:** any file you change in the GitHub repo redeploys the site automatically. Ask Claude for new features and upload the changed files the same way.
- **Free-tier limits:** Supabase free tier includes 500 MB database + 1 GB file storage — thousands of scorecard photos. Vercel's free tier easily covers a hobby site.

## Course database search (golfcourseapi.com)

The "Add a course" form can search a database of ~30,000 courses. To turn it on:

1. Sign in at golfcourseapi.com and copy your API key.
2. In Vercel: Project -> Settings -> Environment Variables -> Add: Name `GOLF_COURSE_API_KEY`, Value = your key (all environments). This stays server-side — visitors never see it.
3. Redeploy (Vercel prompts you, or push any commit).

Without the key the form quietly falls back to manual entry + OpenStreetMap lookup. Note the free tier allows 50 searches/day across all users — searches only run when someone clicks Search, and identical searches are cached for a day.
