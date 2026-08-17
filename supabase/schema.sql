-- Coursebook schema. Run this once in the Supabase SQL editor (Dashboard -> SQL -> New query -> paste -> Run).

-- ============ TABLES ============

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9-]{2,29}$'),
  display_name text not null default '',
  list_title text not null default 'My Top Courses',
  list_size int not null default 25 check (list_size between 1 and 200),
  created_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  rank int not null check (rank >= 1),
  name text not null,
  location text not null default '',
  lat double precision,
  lng double precision,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists entries_user_rank on public.entries (user_id, rank);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  played_on date,
  score int check (score between 18 and 300),
  notes text not null default '',
  scorecard_path text,
  created_at timestamptz not null default now()
);
create index if not exists rounds_entry on public.rounds (entry_id);
create index if not exists rounds_user on public.rounds (user_id);

-- ============ ROW LEVEL SECURITY ============
-- Everyone can view lists (public, shareable pages); only the owner can change their own data.

alter table public.profiles enable row level security;
alter table public.entries  enable row level security;
alter table public.rounds   enable row level security;

create policy "profiles are viewable by everyone" on public.profiles for select using (true);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);

create policy "entries are viewable by everyone" on public.entries for select using (true);
create policy "users insert own entries" on public.entries for insert with check (auth.uid() = user_id);
create policy "users update own entries" on public.entries for update using (auth.uid() = user_id);
create policy "users delete own entries" on public.entries for delete using (auth.uid() = user_id);

create policy "rounds are viewable by everyone" on public.rounds for select using (true);
create policy "users insert own rounds" on public.rounds for insert with check (auth.uid() = user_id);
create policy "users update own rounds" on public.rounds for update using (auth.uid() = user_id);
create policy "users delete own rounds" on public.rounds for delete using (auth.uid() = user_id);

-- ============ SCORECARD IMAGE STORAGE ============
-- Public-read bucket; each user can only write inside their own folder (scorecards/<their-user-id>/...).

insert into storage.buckets (id, name, public)
values ('scorecards', 'scorecards', true)
on conflict (id) do nothing;

create policy "scorecards are publicly readable"
  on storage.objects for select
  using (bucket_id = 'scorecards');

create policy "users upload own scorecards"
  on storage.objects for insert
  with check (bucket_id = 'scorecards' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update own scorecards"
  on storage.objects for update
  using (bucket_id = 'scorecards' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete own scorecards"
  on storage.objects for delete
  using (bucket_id = 'scorecards' and (storage.foldername(name))[1] = auth.uid()::text);
