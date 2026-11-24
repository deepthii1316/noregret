alter table public.settings
  add column if not exists aws_cert text not null default 'AWS Certified Solutions Architect - Associate',
  add column if not exists aws_exam_date date,
  add column if not exists sql_playlist_url text,
  add column if not exists push_enabled boolean not null default false,
  add column if not exists embroidery_reminder_enabled boolean not null default false,
  add column if not exists embroidery_reminder_time time not null default '19:00';

create table public.practice_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tracker_key text not null check (tracker_key in ('aws', 'ml', 'sql')),
  date date not null,
  source text not null,
  score numeric check (score between 0 and 100),
  weak_topics text,
  notes text
);

create table public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  tracker_key text not null check (tracker_key in ('ml', 'sql')),
  title text not null,
  kind text not null default 'course' check (kind in ('course', 'paper', 'notebook', 'playlist', 'other')),
  url text,
  notes text,
  completed boolean not null default false,
  sort_order int not null default 0
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  repo_url text,
  status text not null default 'idea' check (status in ('idea', 'building', 'shipped')),
  stack text,
  notes text,
  sort_order int not null default 0
);

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id uuid references public.projects(id) on delete set null,
  repository text not null,
  issue_url text,
  status text not null default 'exploring' check (status in ('exploring', 'in_progress', 'submitted', 'merged')),
  notes text
);

create table public.good_first_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  repository text not null,
  issue_url text not null,
  notes text,
  status text not null default 'watching' check (status in ('watching', 'claimed', 'dismissed'))
);

create table public.contests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  platform text not null,
  external_id text not null,
  name text not null,
  url text not null,
  start_time timestamptz not null,
  duration_minutes int not null check (duration_minutes > 0),
  attending boolean not null default false,
  manual boolean not null default false,
  synced_at timestamptz,
  unique (user_id, platform, external_id)
);

create table public.contest_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contest_id uuid not null unique references public.contests(id) on delete cascade,
  rank text,
  rating_change int,
  solved int not null default 0 check (solved >= 0),
  total int not null default 0 check (total >= 0),
  notes text,
  check (solved <= total or total = 0)
);

create table public.upsolve_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  title text not null,
  url text,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  notes text
);

create table public.explore_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  status text not null default 'idea' check (status in ('idea', 'exploring', 'explored')),
  notes text,
  resources jsonb not null default '[]',
  key_learnings text,
  sort_order int not null default 0,
  unique (user_id, title)
);

create table public.explore_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  topic_id uuid not null references public.explore_topics(id) on delete cascade,
  date date not null,
  minutes int not null check (minutes > 0),
  notes text
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  status text not null default 'idea' check (status in ('idea', 'drafting', 'ready', 'published')),
  draft text,
  target_date date,
  published_url text,
  sort_order int not null default 0
);

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  week_start date not null,
  went_well text,
  to_fix text,
  priorities text[] not null default '{}',
  unique (user_id, week_start)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  unique (user_id, endpoint)
);

create table public.push_delivery_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  local_date date not null,
  reminder_key text not null,
  unique (user_id, local_date, reminder_key)
);

create table public.embroidery_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  order_date date not null,
  customer text not null,
  design text not null,
  price numeric not null default 0 check (price >= 0),
  material_cost numeric not null default 0 check (material_cost >= 0),
  other_cost numeric not null default 0 check (other_cost >= 0),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'delivered', 'paid')),
  notes text
);

create table public.embroidery_post_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  post_date date not null,
  platform text not null,
  url text,
  note text
);

create index contests_upcoming_idx on public.contests (user_id, start_time);
create index practice_tests_date_idx on public.practice_tests (user_id, tracker_key, date);
create index explore_sessions_date_idx on public.explore_sessions (user_id, date);
create index embroidery_orders_date_idx on public.embroidery_orders (user_id, order_date);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'practice_tests', 'learning_resources', 'projects', 'contributions',
    'good_first_issues', 'contests', 'contest_results', 'upsolve_items',
    'explore_topics', 'explore_sessions', 'blog_posts', 'weekly_reviews',
    'push_subscriptions', 'push_delivery_log', 'embroidery_orders',
    'embroidery_post_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      table_name || '_owner', table_name
    );
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      table_name || '_updated_at', table_name
    );
  end loop;
end $$;

create or replace function public.dashboard_hours_by_day(start_date date, end_date date)
returns table(day date, hours numeric)
language sql stable security invoker as $$
  select te.date, round(sum(te.minutes)::numeric / 60, 2)
  from public.time_entries te
  where te.user_id = auth.uid() and te.date between start_date and end_date
  group by te.date order by te.date
$$;

create or replace function public.dashboard_hours_by_subject(start_date date, end_date date)
returns table(subject text, minutes bigint)
language sql stable security invoker as $$
  select te.subject, sum(te.minutes)::bigint
  from public.time_entries te
  where te.user_id = auth.uid() and te.date between start_date and end_date
  group by te.subject order by sum(te.minutes) desc
$$;

create or replace function public.dashboard_tracker_completion()
returns table(tracker_key text, tracker_name text, total bigint, completed bigint)
language sql stable security invoker as $$
  select t.key, t.name, count(i.id), count(i.id) filter (where i.status in ('done', 'mastered'))
  from public.trackers t
  left join public.tracker_items i on i.tracker_id = t.id and i.user_id = auth.uid()
  where t.user_id = auth.uid()
  group by t.id, t.key, t.name
$$;

grant execute on function public.dashboard_hours_by_day(date, date) to authenticated;
grant execute on function public.dashboard_hours_by_subject(date, date) to authenticated;
grant execute on function public.dashboard_tracker_completion() to authenticated;
