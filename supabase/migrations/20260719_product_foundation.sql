-- Phase-two data model for Phillies Prospect Pulse.
-- Review in Supabase before applying to production.

create table if not exists public.player_biographies (
  player_id uuid primary key references public.players(id) on delete cascade,
  birth_date date,
  height_inches integer,
  weight_pounds integer,
  hometown text,
  acquisition_method text,
  draft_year integer,
  draft_round text,
  draft_pick integer,
  signing_date date,
  rule_5_eligible_year integer,
  on_40_man_roster boolean not null default false,
  risk_label text,
  overall_projection text,
  strengths text[],
  weaknesses text[],
  development_priorities text[],
  updated_at timestamptz not null default now()
);

create table if not exists public.player_stat_snapshots (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  season integer not null,
  snapshot_date date not null,
  window_days integer,
  level text,
  team_name text,
  games integer,
  plate_appearances integer,
  at_bats integer,
  hits integer,
  home_runs integer,
  runs_batted_in integer,
  stolen_bases integer,
  batting_average numeric,
  on_base_percentage numeric,
  slugging_percentage numeric,
  ops numeric,
  innings_pitched numeric,
  earned_run_average numeric,
  strikeouts integer,
  walks integer,
  whip numeric,
  source_name text not null,
  source_url text,
  source_last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique(player_id, season, snapshot_date, window_days, level)
);

create table if not exists public.player_transactions (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  transaction_date date not null,
  transaction_type text not null,
  from_level text,
  to_level text,
  from_team text,
  to_team text,
  description text,
  confidence text not null default 'confirmed',
  source_name text not null,
  source_url text,
  source_last_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.player_injuries (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null,
  body_area text,
  diagnosis text,
  reported_date date,
  injured_list_date date,
  expected_return text,
  return_date date,
  rehabilitation_notes text,
  confidence text not null default 'confirmed',
  official_source_name text,
  official_source_url text,
  context_source_name text,
  context_source_url text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.player_ranking_snapshots (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  ranking_date date not null,
  ranking_scope text not null default 'organization',
  rank integer not null,
  previous_rank integer,
  source_name text not null,
  source_url text,
  created_at timestamptz not null default now(),
  unique(player_id, ranking_date, source_name, ranking_scope)
);

create table if not exists public.news_articles (
  id bigint generated always as identity primary key,
  headline text not null,
  publication_name text not null,
  published_at timestamptz not null,
  source_url text not null unique,
  article_type text not null default 'news',
  summary text,
  confidence text not null default 'confirmed',
  featured_rank integer,
  created_at timestamptz not null default now()
);

create table if not exists public.news_article_players (
  article_id bigint not null references public.news_articles(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  primary key(article_id, player_id)
);

create table if not exists public.prospect_trend_snapshots (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  snapshot_date date not null,
  score numeric not null,
  direction text not null,
  performance_component numeric,
  age_level_component numeric,
  playing_time_component numeric,
  movement_component numeric,
  health_component numeric,
  ranking_component numeric,
  explanation text,
  created_at timestamptz not null default now(),
  unique(player_id, snapshot_date)
);

create table if not exists public.generated_reports (
  id bigint generated always as identity primary key,
  report_type text not null,
  report_date date not null,
  title text not null,
  summary text,
  content jsonb not null default '{}'::jsonb,
  generation_status text not null default 'draft',
  created_at timestamptz not null default now(),
  unique(report_type, report_date)
);

create index if not exists idx_stat_snapshots_player_date on public.player_stat_snapshots(player_id, snapshot_date desc);
create index if not exists idx_transactions_player_date on public.player_transactions(player_id, transaction_date desc);
create index if not exists idx_injuries_player_status on public.player_injuries(player_id, status);
create index if not exists idx_rankings_player_date on public.player_ranking_snapshots(player_id, ranking_date desc);
create index if not exists idx_news_published_at on public.news_articles(published_at desc);
create index if not exists idx_trends_player_date on public.prospect_trend_snapshots(player_id, snapshot_date desc);
