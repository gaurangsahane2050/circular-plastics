-- Circular Plastics Exchange: tables, access rules (RLS) and dashboard views.
-- Run order on a fresh project: this file, then supabase/seed.sql.

create type plastic as enum ('PET', 'HDPE', 'PP', 'LDPE', 'UNCLEAR');
create type user_role as enum ('generator', 'collector', 'recycler', 'plantx');
-- order matters: we compare statuses with < and >= below.
-- matched = user booked a collector + slot, scheduled = collector confirmed the slot
create type batch_status as enum ('requested', 'matched', 'scheduled', 'on_the_way', 'picked_up', 'delivered', 'recycled');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role user_role not null,
  name text not null,
  area text not null,
  lat float8 not null,
  lng float8 not null,
  accepted_types plastic[] not null default '{}',  -- collectors and recyclers only
  capacity_kg numeric not null default 0,
  language text not null default 'en',
  -- personal details, only users fill these in and only they can read them
  age int check (age between 10 and 120),
  gender text,
  phone text
);

-- a user can save several pickup addresses (home, office, clubhouse...)
create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  label text not null,
  line text not null,
  area text not null,
  lat float8 not null,
  lng float8 not null,
  created_at timestamptz not null default now()
);

-- One listing = one batch. Pickup details live on the same row.
create table batches (
  id uuid primary key default gen_random_uuid(),
  generator_id uuid not null default auth.uid() references profiles,
  area text not null,
  lat float8 not null,  -- rounded to ~100 m, exact address is in batch_addresses
  lng float8 not null,
  ai_type plastic,
  ai_confidence numeric,
  final_type plastic not null,
  user_confirmed boolean not null default false,
  verify_at_pickup boolean not null default false,
  photo_hashes text[] not null default '{}',  -- fingerprints of the 1-3 photos
  declared_kg numeric not null check (declared_kg > 0),
  collector_id uuid references profiles,
  recycler_id uuid references profiles,
  scheduled_at timestamptz,  -- start of the 2-hour pickup slot
  actual_kg numeric,
  actual_type plastic,
  quality_grade char(1) check (quality_grade in ('A', 'B', 'C')),
  weight_flag boolean generated always as (abs(actual_kg - declared_kg) > 0.2 * declared_kg) stored,
  status batch_status not null default 'requested',
  last_note text,  -- the trigger copies this into the event log
  created_at timestamptz not null default now()
);

-- The numbered items in a listing (1, 2, 3 ... left to right on the photos), each with its own type.
-- batches.final_type is the most common type among them.
create table batch_items (
  id bigint generated always as identity primary key,
  batch_id uuid not null references batches on delete cascade,
  position int not null,
  name text,  -- what the user called it, e.g. "biscuit wrapper"
  count int not null default 1 check (count > 0),  -- e.g. 6 cookie wrappers
  ai_type plastic,
  ai_confidence numeric,
  type plastic not null
);

-- Kept separate because RLS works per row, not per column.
create table batch_addresses (
  batch_id uuid primary key references batches on delete cascade,
  address text not null,
  phone text
);

-- Chain of custody. Only the trigger below writes here, nobody can edit or delete.
create table status_events (
  id bigint generated always as identity primary key,
  batch_id uuid not null references batches on delete cascade,
  from_status batch_status,
  to_status batch_status not null,
  actor_id uuid references profiles,
  actor_role user_role,
  note text,
  created_at timestamptz not null default now()
);

create table emission_factors (
  plastic plastic primary key,
  kg_co2e_per_kg numeric not null,
  source text not null
);

-- Helper used inside policies. security definer so it can read profiles without
-- running into the profiles policy itself.
create function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

-- Checks that the right role makes each step, then logs it.
create function log_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who user_role := my_role();
begin
  -- reset_demo() writes its own back-dated history
  if current_setting('app.seeding', true) = 'on' then return null; end if;

  if tg_op = 'UPDATE' then
    if old.status = new.status then return null; end if;
    if not ((old.status = 'requested'  and new.status = 'matched'    and who = 'generator')
         or (old.status = 'matched'    and new.status = 'scheduled'  and who = 'collector')
         or (old.status = 'matched'    and new.status = 'requested'  and who = 'collector')  -- can't make that slot
         or (old.status = 'scheduled'  and new.status = 'on_the_way' and who = 'collector')
         or (old.status = 'on_the_way' and new.status = 'picked_up'  and who = 'collector')
         or (old.status = 'picked_up'  and new.status = 'delivered'  and who = 'collector')
         or (old.status = 'delivered'  and new.status = 'recycled'   and who = 'recycler')) then
      raise exception 'A % cannot move a batch from % to %', who, old.status, new.status;
    end if;
  end if;

  insert into status_events (batch_id, from_status, to_status, actor_id, actor_role, note)
  values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid(), who, new.last_note);
  return null;
end $$;

create trigger batch_status_log
after insert or update of status on batches
for each row execute function log_status_change();

-- Row level security ---------------------------------------------------------
alter table profiles enable row level security;
alter table batches enable row level security;
alter table batch_addresses enable row level security;
alter table status_events enable row level security;
alter table emission_factors enable row level security;
alter table addresses enable row level security;
alter table batch_items enable row level security;

-- Collector/recycler profiles are business info needed for matching.
-- Generator profiles (societies, campuses) stay private to themselves.
create policy "read business profiles and own" on profiles for select to authenticated
  using (role <> 'generator' or id = auth.uid());
create policy "edit own profile" on profiles for update to authenticated
  using (id = auth.uid());
-- sign-up creates your own profile, and only as a user. Collectors and recyclers are added by the team.
create policy "sign up as user" on profiles for insert to authenticated
  with check (id = auth.uid() and role = 'generator');

create policy "own addresses" on addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "see own batches" on batches for select to authenticated
  using (auth.uid() in (generator_id, collector_id, recycler_id));
create policy "generators create batches" on batches for insert to authenticated
  with check (generator_id = auth.uid() and my_role() = 'generator');
create policy "people on the batch update it" on batches for update to authenticated
  using (auth.uid() in (generator_id, collector_id, recycler_id));

-- Address shows up for the collector only after they schedule the pickup.
create policy "address for owner or scheduled collector" on batch_addresses for select to authenticated
  using (exists (select 1 from batches b where b.id = batch_id
                 and (b.generator_id = auth.uid() or (b.collector_id = auth.uid() and b.status >= 'scheduled'))));
create policy "owner adds address" on batch_addresses for insert to authenticated
  with check (exists (select 1 from batches b where b.id = batch_id and b.generator_id = auth.uid()));

-- the subquery goes through the batches policy, so you see events of your batches only
create policy "events of visible batches" on status_events for select to authenticated
  using (batch_id in (select id from batches));

create policy "items of visible batches" on batch_items for select to authenticated
  using (batch_id in (select id from batches));
create policy "owner adds items" on batch_items for insert to authenticated
  with check (exists (select 1 from batches b where b.id = batch_id and b.generator_id = auth.uid()));

create policy "factors are public" on emission_factors for select to anon, authenticated using (true);

-- Dashboard views ---------------------------------------------------------------
-- These run as the table owner, so they see every batch, but they only return
-- totals per area/type/month. No names, no addresses.

create view impact_weekly as
select date_trunc('week', e.created_at)::date as week,
       b.area,
       coalesce(b.actual_type, b.final_type) as plastic,
       sum(b.actual_kg) as kg,
       round(sum(b.actual_kg * f.kg_co2e_per_kg), 1) as co2e_kg
from batches b
join status_events e on e.batch_id = b.id and e.to_status = 'recycled'
join emission_factors f on f.plastic = coalesce(b.actual_type, b.final_type)
group by 1, 2, 3;

-- how often the recycler found what the generator said was in the bag
create view sorting_quality as
select area,
       count(*) as checked,
       round(100.0 * count(*) filter (where actual_type = final_type) / count(*)) as match_pct
from batches
where actual_type is not null
group by area;

-- 10 coins per kg, given in full as soon as the collector picks the batch up
create view leaderboard as
select p.id, p.name, p.area, sum(b.declared_kg) as collected_kg, floor(sum(b.declared_kg) * 10) as coins
from profiles p
join batches b on b.generator_id = p.id and b.status >= 'picked_up'
group by p.id;

-- photos where the model was wrong or the user/recycler corrected it -> retraining list
create view model_corrections as
select id, ai_type, ai_confidence, final_type, actual_type, created_at
from batches
where ai_type is distinct from final_type or actual_type <> final_type;

revoke all on impact_weekly, sorting_quality, leaderboard, model_corrections from anon;
grant select on impact_weekly, sorting_quality, leaderboard, model_corrections to authenticated;

-- Fraud check: was this exact photo (same perceptual hash) already used for any listing?
-- Answers yes/no only, so nobody learns whose listing it was.
create function photo_used(hash text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from batches where hash = any(photo_hashes))
$$;
revoke execute on function photo_used(text) from public, anon;
grant execute on function photo_used(text) to authenticated;

-- How full each upcoming slot of a collector is. Users can't see other people's batches,
-- so this only returns slot times and counts.
create function slot_bookings(collector uuid) returns table (slot timestamptz, booked bigint)
language sql stable security definer set search_path = public as $$
  select scheduled_at, count(*) from batches
  where collector_id = collector and status in ('matched', 'scheduled', 'on_the_way') and scheduled_at > now()
  group by scheduled_at
$$;
revoke execute on function slot_bookings(uuid) from public, anon;
grant execute on function slot_bookings(uuid) to authenticated;

-- Public page behind the QR code. Returns the history of one batch without any names.
create function batch_history(batch uuid)
returns table (plastic plastic, area text, kg numeric, grade char, status batch_status, by_role user_role, at timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce(b.actual_type, b.final_type), b.area, coalesce(b.actual_kg, b.declared_kg),
         b.quality_grade, e.to_status, e.actor_role, e.created_at
  from batches b
  join status_events e on e.batch_id = b.id
  where b.id = batch
  order by e.created_at
$$;
grant execute on function batch_history(uuid) to anon, authenticated;
