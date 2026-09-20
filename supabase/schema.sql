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
  question_order int[] not null default '{}',
  playlist_id text not null default 'full',
  created_at timestamptz not null default now()
);

alter table rooms add column if not exists playlist_id text not null default 'full';

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

-- MVP: no auth yet. Open policies so the Next.js app can read/write with the anon key.
-- Tighten before a public launch.
create policy "rooms open" on rooms for all using (true) with check (true);
create policy "players open" on players for all using (true) with check (true);
create policy "answers open" on answers for all using (true) with check (true);

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
