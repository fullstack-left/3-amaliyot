-- =============================================================================
-- Chorraha Boshqaruvi — progression, economy and anti-cheat schema
-- =============================================================================
-- Trust model:
--   * Clients can READ their own rows (RLS) but can never write progress or
--     coins directly.
--   * Progress + coins are written only by the `submit-run` edge function
--     (service role) AFTER it re-simulated the replay with the shared engine.
--   * Purchases go through `purchase_item` (SECURITY DEFINER, atomic coin check).
-- =============================================================================

-- ---------- tables ------------------------------------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (display_name is null or char_length(display_name) between 2 and 32),
  coins         integer not null default 0 check (coins >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.shop_catalog (
  item_id  text primary key,
  kind     text not null check (kind in ('model', 'paint', 'mod')),
  price    integer not null check (price >= 0)
);

create table if not exists public.garage_items (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  item_id      text not null references public.shop_catalog (item_id),
  acquired_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table if not exists public.garage_loadout (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  model       text not null default 'matiz',
  paint       text not null default 'sariq',
  mods        text[] not null default '{}',
  updated_at  timestamptz not null default now()
);

create table if not exists public.level_progress (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  level_id      integer not null check (level_id between 1 and 1000),
  stars         smallint not null check (stars between 0 and 3),
  best_time_ms  integer not null check (best_time_ms > 0),
  runs          integer not null default 1,
  updated_at    timestamptz not null default now(),
  primary key (user_id, level_id)
);

create table if not exists public.runs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  level_id    integer not null,
  replay      jsonb not null,
  replay_hash text not null,
  result      jsonb not null,
  reward      integer not null default 0,
  created_at  timestamptz not null default now(),
  -- the same replay can never be paid twice (anti-farming)
  unique (user_id, replay_hash)
);

create index if not exists runs_user_level_idx on public.runs (user_id, level_id, created_at desc);
create index if not exists level_progress_board_idx on public.level_progress (level_id, stars desc, best_time_ms asc);

-- ---------- catalog seed (mirrors src/content/garage.ts; a test keeps them in sync) ----

insert into public.shop_catalog (item_id, kind, price) values
  ('matiz', 'model', 0),
  ('damas', 'model', 120),
  ('nexia3', 'model', 150),
  ('spark', 'model', 200),
  ('cobalt', 'model', 350),
  ('gentra', 'model', 450),
  ('tracker', 'model', 700),
  ('malibu', 'model', 1000),
  ('oq', 'paint', 0),
  ('sariq', 'paint', 0),
  ('kumush', 'paint', 40),
  ('qora', 'paint', 40),
  ('qizil', 'paint', 60),
  ('kok', 'paint', 60),
  ('yashil', 'paint', 60),
  ('olcha', 'paint', 80),
  ('xameleon', 'paint', 200),
  ('sport_wheels', 'mod', 120),
  ('spoiler', 'mod', 90),
  ('metan', 'mod', 40),
  ('tint', 'mod', 60),
  ('neon', 'mod', 150),
  ('shashka', 'mod', 50),
  ('gilam', 'mod', 80)
on conflict (item_id) do update set kind = excluded.kind, price = excluded.price;

-- ---------- new user bootstrap ------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.garage_items (user_id, item_id)
    values (new.id, 'matiz'), (new.id, 'oq'), (new.id, 'sariq')
    on conflict do nothing;
  insert into public.garage_loadout (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- row level security --------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.shop_catalog   enable row level security;
alter table public.garage_items   enable row level security;
alter table public.garage_loadout enable row level security;
alter table public.level_progress enable row level security;
alter table public.runs           enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "profiles: rename own" on public.profiles;
create policy "profiles: rename own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
-- only the display name is client-editable; coins change exclusively via functions
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

drop policy if exists "catalog: public read" on public.shop_catalog;
create policy "catalog: public read" on public.shop_catalog for select to anon, authenticated using (true);

drop policy if exists "garage: read own" on public.garage_items;
create policy "garage: read own" on public.garage_items
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "loadout: read own" on public.garage_loadout;
create policy "loadout: read own" on public.garage_loadout
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "progress: read own" on public.level_progress;
create policy "progress: read own" on public.level_progress
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "runs: read own" on public.runs;
create policy "runs: read own" on public.runs
  for select to authenticated using ((select auth.uid()) = user_id);

-- No INSERT/UPDATE/DELETE policies on progress, runs, garage_items, loadout:
-- writes happen only inside the SECURITY DEFINER functions below.

-- ---------- purchases -----------------------------------------------------------------

create or replace function public.purchase_item(p_item_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_price integer;
  v_coins integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select price into v_price from public.shop_catalog where item_id = p_item_id;
  if v_price is null then
    raise exception 'unknown_item' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.garage_items where user_id = v_uid and item_id = p_item_id) then
    raise exception 'already_owned' using errcode = 'P0001';
  end if;
  update public.profiles
     set coins = coins - v_price, updated_at = now()
   where id = v_uid and coins >= v_price
  returning coins into v_coins;
  if v_coins is null then
    raise exception 'insufficient_coins' using errcode = 'P0001';
  end if;
  insert into public.garage_items (user_id, item_id) values (v_uid, p_item_id);
  return v_coins;
end;
$$;

create or replace function public.set_loadout(p_model text, p_paint text, p_mods text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_missing integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select count(*) into v_missing
    from unnest(array[p_model, p_paint] || coalesce(p_mods, '{}')) as want(item_id)
   where not exists (select 1 from public.garage_items g where g.user_id = v_uid and g.item_id = want.item_id);
  if v_missing > 0 then
    raise exception 'item_not_owned' using errcode = 'P0001';
  end if;
  insert into public.garage_loadout (user_id, model, paint, mods, updated_at)
  values (v_uid, p_model, p_paint, coalesce(p_mods, '{}'), now())
  on conflict (user_id) do update
    set model = excluded.model, paint = excluded.paint, mods = excluded.mods, updated_at = now();
end;
$$;

-- ---------- verified run application (edge function only) -----------------------------

create or replace function public.apply_run(
  p_user          uuid,
  p_level         integer,
  p_stars         integer,
  p_time_ms       integer,
  p_vehicle_coins integer,
  p_band_bonus    integer,
  p_star_coins    integer,
  p_replay        jsonb,
  p_replay_hash   text,
  p_result        jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev   integer;
  v_reward integer;
  v_coins  integer;
begin
  if p_stars not between 1 and 3 or p_time_ms <= 0 then
    raise exception 'invalid_result' using errcode = '22023';
  end if;
  -- serialise concurrent submissions of the same user+level (first-clear bonus is paid once)
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_level::text, 0));
  if exists (select 1 from public.runs where user_id = p_user and replay_hash = p_replay_hash) then
    raise exception 'duplicate_run' using errcode = '23505';
  end if;

  select stars into v_prev from public.level_progress where user_id = p_user and level_id = p_level;
  v_prev := coalesce(v_prev, 0);
  v_reward := greatest(0, p_vehicle_coins)
            + case when v_prev = 0 then greatest(0, p_band_bonus) else 0 end
            + greatest(0, p_star_coins) * greatest(0, p_stars - v_prev);

  insert into public.level_progress as lp (user_id, level_id, stars, best_time_ms, runs, updated_at)
  values (p_user, p_level, p_stars, p_time_ms, 1, now())
  on conflict (user_id, level_id) do update
    set stars        = greatest(lp.stars, excluded.stars),
        best_time_ms = least(lp.best_time_ms, excluded.best_time_ms),
        runs         = lp.runs + 1,
        updated_at   = now();

  update public.profiles set coins = coins + v_reward, updated_at = now()
   where id = p_user
  returning coins into v_coins;

  insert into public.runs (user_id, level_id, replay, replay_hash, result, reward)
  values (p_user, p_level, p_replay, p_replay_hash, p_result, v_reward);

  return jsonb_build_object('reward', v_reward, 'coins', v_coins, 'prev_stars', v_prev);
end;
$$;

-- ---------- public leaderboard (no personal data beyond the display name) -------------

create or replace function public.leaderboard(p_level integer, p_limit integer default 20)
returns table (rank bigint, display_name text, stars smallint, best_time_ms integer)
language sql
stable
security definer
set search_path = ''
as $$
  select row_number() over (order by lp.stars desc, lp.best_time_ms asc) as rank,
         coalesce(p.display_name, 'Haydovchi') as display_name,
         lp.stars,
         lp.best_time_ms
    from public.level_progress lp
    join public.profiles p on p.id = lp.user_id
   where lp.level_id = p_level
   order by lp.stars desc, lp.best_time_ms asc
   limit least(greatest(p_limit, 1), 100);
$$;

-- ---------- function privileges -------------------------------------------------------

revoke all on function public.purchase_item(text)                     from public, anon;
revoke all on function public.set_loadout(text, text, text[])         from public, anon;
revoke all on function public.apply_run(uuid, integer, integer, integer, integer, integer, integer, jsonb, text, jsonb) from public, anon, authenticated;
revoke all on function public.leaderboard(integer, integer)           from public;
revoke all on function public.handle_new_user()                       from public, anon, authenticated;

grant execute on function public.purchase_item(text)              to authenticated;
grant execute on function public.set_loadout(text, text, text[])  to authenticated;
grant execute on function public.apply_run(uuid, integer, integer, integer, integer, integer, integer, jsonb, text, jsonb) to service_role;
grant execute on function public.leaderboard(integer, integer)    to anon, authenticated;
