-- Deny-by-default row level security.
-- Production QuizRival does not use Supabase (rooms stay in process memory).
-- There is no packs table. With these policies removed, the public anon key
-- cannot list or read rooms, players, or answers. The service role bypasses RLS;
-- do not ship the anon key as a way to query this data.

alter table if exists rooms enable row level security;
alter table if exists players enable row level security;
alter table if exists answers enable row level security;

drop policy if exists "rooms open" on rooms;
drop policy if exists "players open" on players;
drop policy if exists "answers open" on answers;

revoke all on table rooms from anon, authenticated;
revoke all on table players from anon, authenticated;
revoke all on table answers from anon, authenticated;
