-- =============================================================================
-- Chorraha Boshqaruvi v3 — daily challenges, leaderboard "is_me", own rank,
-- display-name hygiene. Apply after 20260927000000_init.sql.
-- =============================================================================
-- * Daily challenges are stored in level_progress with id 100000 + day index
--   (days since 2026-01-01). The submit-run edge function rebuilds the level
--   from the id with the shared deterministic generator and accepts only days
--   inside a short window around "today" (see content/daily.ts dailyAcceptable).
-- * Endless mode is local-only (no coins) and never reaches the server.
-- =============================================================================

-- ---------- level ids: campaign 1..1000 + daily 100000..199999 --------------------------

alter table public.level_progress drop constraint if exists level_progress_level_id_check;
alter table public.level_progress add constraint level_progress_level_id_check
  check (level_id between 1 and 1000 or level_id between 100000 and 199999);

alter table public.runs drop constraint if exists runs_level_id_check;
alter table public.runs add constraint runs_level_id_check
  check (level_id between 1 and 1000 or level_id between 100000 and 199999);

-- ---------- display names: trimmed, no control characters --------------------------------

alter table public.profiles drop constraint if exists profiles_display_name_check;
alter table public.profiles add constraint profiles_display_name_check
  check (
    display_name is null
    or (char_length(display_name) between 2 and 32
        and display_name = btrim(display_name)
        and display_name !~ '[[:cntrl:]]')
  );

-- ---------- leaderboard v2: marks the caller's own row --------------------------------------

drop function if exists public.leaderboard(integer, integer);
create function public.leaderboard(p_level integer, p_limit integer default 20)
returns table (rank bigint, display_name text, stars smallint, best_time_ms integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select row_number() over (order by lp.stars desc, lp.best_time_ms asc, lp.updated_at asc) as rank,
         coalesce(p.display_name, 'Haydovchi') as display_name,
         lp.stars,
         lp.best_time_ms,
         coalesce(lp.user_id = (select auth.uid()), false) as is_me
    from public.level_progress lp
    join public.profiles p on p.id = lp.user_id
   where lp.level_id = p_level
   order by lp.stars desc, lp.best_time_ms asc, lp.updated_at asc
   limit least(greatest(p_limit, 1), 100);
$$;

-- ---------- the caller's own position (also outside the top N) ------------------------------

create or replace function public.my_rank(p_level integer)
returns table (rank bigint, total bigint, stars smallint, best_time_ms integer)
language sql
stable
security definer
set search_path = ''
as $$
  with board as (
    select lp.user_id, lp.stars, lp.best_time_ms,
           row_number() over (order by lp.stars desc, lp.best_time_ms asc, lp.updated_at asc) as rank,
           count(*) over () as total
      from public.level_progress lp
     where lp.level_id = p_level
  )
  select b.rank, b.total, b.stars, b.best_time_ms
    from board b
   where b.user_id = (select auth.uid());
$$;

-- ---------- function privileges --------------------------------------------------------------

revoke all on function public.leaderboard(integer, integer) from public;
revoke all on function public.my_rank(integer)              from public, anon;
grant execute on function public.leaderboard(integer, integer) to anon, authenticated;
grant execute on function public.my_rank(integer)              to authenticated;
