create extension if not exists pgcrypto;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  mlb_id bigint unique,
  full_name text not null,
  first_name text,
  last_name text,
  primary_position text,
  birth_date date,
  bats text check (bats in ('L', 'R', 'S') or bats is null),
  throws text check (throws in ('L', 'R') or throws is null),
  height_inches smallint check (height_inches > 0 or height_inches is null),
  weight_lbs smallint check (weight_lbs > 0 or weight_lbs is null),
  birth_country text,
  current_level text,
  current_team_name text,
  organization_status text not null default 'active'
    check (organization_status in ('active', 'inactive', 'released', 'traded', 'retired', 'unknown')),
  is_top_30 boolean not null default false,
  mlb_pipeline_rank smallint check (mlb_pipeline_rank between 1 and 30 or mlb_pipeline_rank is null),
  estimated_arrival_year smallint,
  profile_url text,
  source_name text not null default 'MLB',
  source_url text,
  source_last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists players_full_name_idx on public.players (full_name);
create index if not exists players_current_level_idx on public.players (current_level);
create index if not exists players_pipeline_rank_idx on public.players (mlb_pipeline_rank);
create index if not exists players_organization_status_idx on public.players (organization_status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at
before update on public.players
for each row execute function public.set_updated_at();

alter table public.players enable row level security;

create policy "Public can read player master data"
on public.players
for select
to anon, authenticated
using (true);

comment on table public.players is 'Canonical Phillies player master records keyed by MLB player ID whenever available.';
comment on column public.players.current_level is 'Broad official level such as MLB, AAA, AA, A+, A, ROK, or COMPLEX.';
comment on column public.players.mlb_pipeline_rank is 'Current Phillies organizational rank from MLB Pipeline; null for unranked players.';
