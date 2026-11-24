-- NoRegret: milestones 1-5 schema. Every table: user_id default auth.uid(), RLS on, owner-only policy.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  timezone text not null default 'Asia/Kolkata',
  time_format text not null default '12h' check (time_format in ('12h','24h')),
  study_hours_target numeric not null default 10,
  min_study_hours numeric not null default 5,
  water_target int not null default 2500,
  sleep_target numeric not null default 7,
  dsa_phase text not null default 'roadmap' check (dsa_phase in ('roadmap','cses')),
  roadmap_current_day int not null default 1,
  roadmap_started_on date,
  days_per_week int not null default 5 check (days_per_week between 1 and 7),
  cses_priority jsonb not null default '[]',
  cses_per_day int not null default 4,
  jobs_app_url text,
  unique (user_id)
);

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  seed_slug text,
  key text,
  title text not null,
  subject text not null default 'Other',
  start_time time not null,
  end_time time not null,
  days int[] not null,
  kind text not null default 'study',
  flex_by_day jsonb,
  is_study boolean not null default false,
  sort_order int not null default 0,
  color text,
  unique (user_id, seed_slug)
);

create table public.block_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  block_id uuid not null references schedule_blocks(id) on delete cascade,
  sub_key text not null default '',
  date date not null,
  completed boolean not null default true,
  actual_minutes int,
  note text,
  unique (user_id, block_id, sub_key, date)
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  date date not null,
  subject text not null,
  minutes int not null check (minutes >= 0),
  note text,
  source text not null default 'manual',
  unique (user_id, date, source)
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null,
  name text not null,
  type text not null default 'checkbox' check (type in ('checkbox','counter','duration','time')),
  target numeric,
  unit text,
  category text not null default 'health' check (category in ('health','home')),
  schedule int[] not null default '{0,1,2,3,4,5,6}',
  sort_order int not null default 0,
  active boolean not null default true,
  unique (user_id, slug)
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  habit_id uuid not null references habits(id) on delete cascade,
  date date not null,
  value numeric not null default 0,
  note text,
  unique (user_id, habit_id, date)
);

create table public.night_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  date date not null,
  regret_score int check (regret_score between 1 and 5),
  improve_note text,
  proud_note text,
  unique (user_id, date)
);

create table public.daily_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  date date not null,
  minimum_met boolean not null default false,
  study_minutes int not null default 0,
  unique (user_id, date)
);

create table public.trackers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  key text not null,
  name text not null,
  icon text,
  sort_order int not null default 0,
  unique (user_id, key)
);

create table public.tracker_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tracker_id uuid not null references trackers(id) on delete cascade,
  slug text not null,
  name text not null,
  pattern_note text,
  meta jsonb not null default '{}',
  sort_order int not null default 0,
  unique (user_id, tracker_id, slug)
);

create table public.tracker_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tracker_id uuid not null references trackers(id) on delete cascade,
  group_id uuid not null references tracker_groups(id) on delete cascade,
  slug text not null,
  title text not null,
  status text not null default 'todo' check (status in ('todo','doing','done','mastered')),
  difficulty text check (difficulty in ('easy','medium','hard')),
  label text,
  platform text,
  link text,
  external_id text,
  notes text,
  needs_revision boolean not null default false,
  completed_at timestamptz,
  last_revised_at timestamptz,
  next_revision_at timestamptz,
  revision_count int not null default 0,
  times_solved int not null default 0,
  sort_order int not null default 0,
  unique (user_id, tracker_id, slug)
);

create table public.daily_solve_counts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  date date not null,
  tracker_key text not null,
  count int not null default 0,
  unique (user_id, date, tracker_key)
);

-- hot-path indexes
create index on public.block_completions (user_id, date);
create index on public.time_entries (user_id, date);
create index on public.habit_logs (user_id, date);
create index on public.daily_status (user_id, date);
create index on public.tracker_items (group_id);
create index on public.tracker_items (user_id, needs_revision) where needs_revision;
create index on public.tracker_items (user_id, next_revision_at);

alter table public.settings enable row level security;
create policy "settings_owner" on public.settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

alter table public.schedule_blocks enable row level security;
create policy "schedule_blocks_owner" on public.schedule_blocks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger schedule_blocks_updated_at before update on public.schedule_blocks
  for each row execute function public.set_updated_at();

alter table public.block_completions enable row level security;
create policy "block_completions_owner" on public.block_completions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger block_completions_updated_at before update on public.block_completions
  for each row execute function public.set_updated_at();

alter table public.time_entries enable row level security;
create policy "time_entries_owner" on public.time_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger time_entries_updated_at before update on public.time_entries
  for each row execute function public.set_updated_at();

alter table public.habits enable row level security;
create policy "habits_owner" on public.habits for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger habits_updated_at before update on public.habits
  for each row execute function public.set_updated_at();

alter table public.habit_logs enable row level security;
create policy "habit_logs_owner" on public.habit_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger habit_logs_updated_at before update on public.habit_logs
  for each row execute function public.set_updated_at();

alter table public.night_checks enable row level security;
create policy "night_checks_owner" on public.night_checks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger night_checks_updated_at before update on public.night_checks
  for each row execute function public.set_updated_at();

alter table public.daily_status enable row level security;
create policy "daily_status_owner" on public.daily_status for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger daily_status_updated_at before update on public.daily_status
  for each row execute function public.set_updated_at();

alter table public.trackers enable row level security;
create policy "trackers_owner" on public.trackers for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger trackers_updated_at before update on public.trackers
  for each row execute function public.set_updated_at();

alter table public.tracker_groups enable row level security;
create policy "tracker_groups_owner" on public.tracker_groups for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger tracker_groups_updated_at before update on public.tracker_groups
  for each row execute function public.set_updated_at();

alter table public.tracker_items enable row level security;
create policy "tracker_items_owner" on public.tracker_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger tracker_items_updated_at before update on public.tracker_items
  for each row execute function public.set_updated_at();

alter table public.daily_solve_counts enable row level security;
create policy "daily_solve_counts_owner" on public.daily_solve_counts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger daily_solve_counts_updated_at before update on public.daily_solve_counts
  for each row execute function public.set_updated_at();
