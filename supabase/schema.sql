-- QuizRival sibling-challenge schema (optional)
-- Run in the Supabase SQL editor, then enable Realtime on these tables.

create table if not exists rooms (
  code text primary key,
  status text not null check (status in ('lobby', 'playing', 'finished')),
  quiz_id text not null,
  variant text not null check (variant in ('A', 'B')),
  host_id text not null,
  current_question_index int not null default 0,
  question_ends_at timestamptz,
  paused boolean not null default false,
  paused_remaining_ms integer,
  question_order int[] not null default '{}',
  playlist_id text not null default 'full',
  level_id text,
  created_at timestamptz not null default now()
);

alter table rooms add column if not exists playlist_id text not null default 'full';
alter table rooms add column if not exists level_id text;
alter table rooms add column if not exists paused boolean not null default false;
alter table rooms add column if not exists paused_remaining_ms integer;

create table if not exists players (
  id text primary key,
  room_code text not null references rooms(code) on delete cascade,
  name text not null,
  score int not null default 0
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references rooms(code) on delete cascade,
  player_id text not null,
  question_id text not null,
  choice text not null,
  correct boolean not null,
  unique (room_code, player_id, question_id)
);

alter table rooms enable row level security;
alter table players enable row level security;
alter table answers enable row level security;

drop policy if exists "rooms open" on rooms;
drop policy if exists "players open" on players;
drop policy if exists "answers open" on answers;

-- Deny by default. There is no packs table. The anon key cannot list rooms,
-- players, or answers. Production uses the in-memory store. A later Supabase
-- path must use the service role; do not add policies for anon.

-- Realtime (ignore error if already added)
do $$
begin
  alter publication supabase_realtime add table rooms;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table players;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table answers;
exception
  when duplicate_object then null;
end $$;
