-- Fictional demo data. Every name, area, address and number in here is made up.
-- Demo logins (password demo1234): user@demo.test, collector@demo.test, recycler@demo.test, plantx@demo.test

-- People ----------------------------------------------------------------------
create temp table demo_people (email text, role user_role, name text, area text, lat float8, lng float8, types plastic[], cap numeric);
insert into demo_people values
  ('user@demo.test', 'generator', 'Sagar Heights CHS',          'Sagar Nagar',     19.101, 72.842, '{}', 0),
  (null, 'generator', 'Coral Bay CHS',                               'Sagar Nagar',     19.096, 72.836, '{}', 0),
  (null, 'generator', 'Sea Breeze Apartments',                       'Sagar Nagar',     19.104, 72.848, '{}', 0),
  (null, 'generator', 'Sunrise Bakery',                              'Sagar Nagar',     19.099, 72.851, '{}', 0),
  (null, 'generator', 'Palm Grove CHS',                              'Palm Vihar',      19.072, 72.879, '{}', 0),
  (null, 'generator', 'Green Leaf Residency',                        'Palm Vihar',      19.067, 72.884, '{}', 0),
  (null, 'generator', 'Vihar Kirana Store',                          'Palm Vihar',      19.074, 72.887, '{}', 0),
  (null, 'generator', 'Palm Vihar Junior College',                   'Palm Vihar',      19.064, 72.876, '{}', 0),
  (null, 'generator', 'Tekdi Nest CHS',                              'Tekdi Colony',    19.131, 72.909, '{}', 0),
  (null, 'generator', 'Hilltop Towers',                              'Tekdi Colony',    19.127, 72.914, '{}', 0),
  (null, 'generator', 'Shanti Sadan CHS',                            'Tekdi Colony',    19.134, 72.905, '{}', 0),
  (null, 'generator', 'Udyog Bhavan Offices',                        'Udyog Park',      19.041, 72.861, '{}', 0),
  (null, 'generator', 'Metro Print Works',                           'Udyog Park',      19.037, 72.857, '{}', 0),
  (null, 'generator', 'Udyog Park Canteen',                          'Udyog Park',      19.044, 72.866, '{}', 0),
  (null, 'generator', 'Lakeview Engineering College',                'Lakeview Campus', 19.171, 72.951, '{}', 0),
  (null, 'generator', 'Lakeview Hostel Block B',                     'Lakeview Campus', 19.168, 72.946, '{}', 0),
  (null, 'generator', 'Lakeview Cafe',                               'Lakeview Campus', 19.174, 72.955, '{}', 0),
  (null, 'generator', 'Blue Lotus CHS',                              'Lakeview Campus', 19.165, 72.958, '{}', 0),
  ('collector@demo.test', 'collector', 'Asha Scrap Collectors',      'Palm Vihar',      19.080, 72.870, '{PET,HDPE,PP,LDPE}', 200),
  (null, 'collector', 'Ganesh Raddi Mart',                           'Sagar Nagar',     19.098, 72.845, '{PET,HDPE}', 80),
  (null, 'collector', 'Tekdi Kabadi Co-op',                          'Tekdi Colony',    19.129, 72.912, '{PET,PP,LDPE}', 60),
  (null, 'collector', 'GreenCart Pickups',                           'Udyog Park',      19.046, 72.859, '{PET,HDPE,PP}', 120),
  (null, 'collector', 'Lakeview Waste Pickers Group',                'Lakeview Campus', 19.169, 72.949, '{PET,LDPE}', 50),
  (null, 'collector', 'Mobile Kabadi Van 7',                         'Palm Vihar',      19.069, 72.882, '{HDPE,PP,LDPE}', 100),
  ('recycler@demo.test', 'recycler', 'Circle Polymers Recycling',    'Udyog Park',      19.039, 72.864, '{PET,HDPE,PP,LDPE}', 2000),
  (null, 'recycler', 'PET Loop Industries',                          'Lakeview Campus', 19.176, 72.960, '{PET}', 1500),
  (null, 'recycler', 'FlexiFilm Reprocessors',                       'Tekdi Colony',    19.136, 72.918, '{PP,LDPE}', 1000),
  ('plantx@demo.test', 'plantx', 'Plant X Feedstock Team',           'Udyog Park',      19.042, 72.868, '{}', 0);

-- everyone without a demo login gets user1@demo.test, user2@demo.test, ...
update demo_people p set email = 'user' || n || '@demo.test'
from (select ctid, row_number() over () as n from demo_people where email is null) x
where p.ctid = x.ctid;

-- Supabase keeps logins in auth.users + auth.identities. The empty strings matter,
-- the auth server fails on NULL in those token columns.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', md5(email)::uuid, 'authenticated', 'authenticated', email,
  extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', ''
from demo_people;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select md5(email)::uuid::text, md5(email)::uuid,
  jsonb_build_object('sub', md5(email)::uuid::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()
from demo_people;

insert into profiles (id, role, name, area, lat, lng, accepted_types, capacity_kg)
select md5(email)::uuid, role, name, area, lat, lng, types, cap from demo_people;

-- the demo user's personal details and two saved addresses (all made up)
update profiles set age = 34, gender = 'Female', phone = '+91 90000 00001' where id = md5('user@demo.test')::uuid;
insert into addresses (user_id, label, line, area, lat, lng) values
  (md5('user@demo.test')::uuid, 'Home', 'Flat 402, Sagar Heights CHS, Gate 3', 'Sagar Nagar', 19.101, 72.842),
  (md5('user@demo.test')::uuid, 'Clubhouse', 'Sagar Heights clubhouse, back gate', 'Sagar Nagar', 19.099, 72.846);

-- Emission factors --------------------------------------------------------------
-- PLACEHOLDERS. Replace with values from a cited life-cycle study before the final demo.
insert into emission_factors values
  ('PET',     1.5, 'PLACEHOLDER - replace with cited source'),
  ('HDPE',    1.0, 'PLACEHOLDER - replace with cited source'),
  ('PP',      1.0, 'PLACEHOLDER - replace with cited source'),
  ('LDPE',    1.0, 'PLACEHOLDER - replace with cited source'),
  ('UNCLEAR', 0,   'not counted');

-- Three months of history ----------------------------------------------------------
-- Story the dashboard should tell: PET is the most common type, volumes grow every
-- month, and Tekdi Colony sorts badly (recyclers often find a different plastic).
create or replace function reset_demo() returns void
language plpgsql security definer set search_path = public as $$
declare
  g profiles;
  steps batch_status[] := enum_range(null::batch_status);
  r float8; conf numeric; kg numeric; bad_sort boolean;
  t plastic; found_type plastic; st batch_status;
  created timestamptz; coll uuid; rec uuid; b uuid;
begin
  perform set_config('app.seeding', 'on', true);  -- trigger stays quiet, we write the history ourselves
  perform setseed(0.42);                           -- same "random" data after every reset
  delete from batches where true;                  -- also clears events and addresses (cascade).
                                                   -- "where true" because Supabase blocks DELETE without WHERE

  for g in select * from profiles where role = 'generator' order by name loop
    for i in 1 .. 8 + floor(random() * 8)::int loop
      created := now() - 90 * (1 - sqrt(random())) * interval '1 day';  -- more batches in recent weeks
      r := random();
      t := case when r < 0.45 then 'PET' when r < 0.65 then 'HDPE' when r < 0.85 then 'PP' else 'LDPE' end;
      conf := round((0.5 + random() * 0.49)::numeric, 2);
      kg := round((3 + random() * 27)::numeric, 1);
      bad_sort := random() < case when g.area = 'Tekdi Colony' then 0.45 else 0.08 end;
      found_type := case when bad_sort
        then (select x from unnest(array['PET', 'HDPE', 'PP', 'LDPE']::plastic[]) x where x <> t order by random() limit 1)
        else t end;
      st := case when created < now() - interval '10 days' then 'recycled' else steps[1 + floor(random() * 7)::int] end;
      coll := (select id from profiles where role = 'collector' and t = any(accepted_types) order by random() limit 1);
      rec := (select id from profiles where role = 'recycler' and t = any(accepted_types) order by random() limit 1);
      if st <> 'recycled' then  -- open batches go to the demo logins so every role has work to show
        coll := md5('collector@demo.test')::uuid;
        rec := md5('recycler@demo.test')::uuid;
      end if;

      insert into batches (generator_id, area, lat, lng, ai_type, ai_confidence, final_type, user_confirmed,
        verify_at_pickup, declared_kg, collector_id, recycler_id, scheduled_at, actual_kg, actual_type,
        quality_grade, status, created_at)
      values (g.id, g.area, round(g.lat::numeric, 3), round(g.lng::numeric, 3),
        case when conf < 0.6 and random() < 0.5 then 'UNCLEAR' else t end, conf, t, conf < 0.85, conf < 0.6, kg,
        case when st >= 'matched' then coll end,
        case when st >= 'delivered' then rec end,
        -- open bookings get a real upcoming slot (9, 12 or 16 o'clock Indian time), old ones a past one
        case when st in ('matched', 'scheduled', 'on_the_way')
          then (date_trunc('day', now() at time zone 'Asia/Kolkata') + (1 + floor(random() * 2)) * interval '1 day'
                + (array[9, 12, 16])[1 + floor(random() * 3)::int] * interval '1 hour') at time zone 'Asia/Kolkata'
          when st >= 'matched' then created + interval '1 day' end,
        -- about 6% of batches come in much lighter than declared -> weight flag
        case when st = 'recycled' then round(kg * (case when random() < 0.06 then 0.6 else 0.9 + random() * 0.15 end)::numeric, 1) end,
        case when st = 'recycled' then found_type end,
        case when st = 'recycled' then case when bad_sort then 'C' when random() < 0.6 then 'A' else 'B' end end,
        st, created)
      returning id into b;

      insert into batch_addresses values (b, 'Gate ' || (1 + floor(random() * 3))::int || ', ' || g.name || ', ' || g.area);

      -- one event per step, a day apart: user makes steps 1-2, collector 3-6, recycler 7
      for step in 1 .. array_position(steps, st) loop
        insert into status_events (batch_id, from_status, to_status, actor_id, actor_role, created_at)
        values (b, steps[step - 1], steps[step],
          case when step <= 2 then g.id when step <= 6 then coll else rec end,
          case when step <= 2 then 'generator' when step <= 6 then 'collector' else 'recycler' end::user_role,
          least(created + (step - 1) * interval '1 day', now()));
      end loop;
    end loop;
  end loop;
end $$;

revoke execute on function reset_demo() from public, anon;
grant execute on function reset_demo() to authenticated;

select reset_demo();
