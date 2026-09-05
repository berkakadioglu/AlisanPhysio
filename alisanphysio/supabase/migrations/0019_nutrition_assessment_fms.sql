-- Run manually after 0018. Application changes require this migration.
begin;

-- INTENTIONAL CLEANUP: delete every unmapped category, regardless of name/default.
-- Any mapped category, including Alisan Signature, survives.
delete from public.exercise_categories c where not exists (
  select 1 from public.exercise_category_map m where m.category_id = c.id
);

-- Backfill only on first addition: reruns must preserve subsequent opt-outs.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'profiles' and column_name = 'nutrition_enabled') then
    alter table public.profiles add column nutrition_enabled boolean not null default false;
    update public.profiles p set nutrition_enabled = true
      where exists (select 1 from public.nutrition_plans n where n.client_id = p.id);
  end if;
end $$;

-- Same privileged-column guard and trusted service-role bypass as 0008.
create or replace function public.profiles_guard_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change a user''s role.' using errcode = '42501';
  end if;
  if (new.membership is distinct from old.membership
    or new.membership_end_date is distinct from old.membership_end_date
    or new.nutrition_enabled is distinct from old.nutrition_enabled)
    and not public.is_staff() then
    raise exception 'Only staff can change membership or nutrition access.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns before update on public.profiles
  for each row execute function public.profiles_guard_privileged_columns();

alter table public.assessment_requests add column if not exists biggest_expectation text;

alter table public.coach_settings
  add column if not exists fms_enabled boolean not null default true,
  add column if not exists fms_days int[] not null default '{1,2,3,4,5}',
  add column if not exists fms_window_start time not null default '15:00',
  add column if not exists fms_window_end time not null default '18:00',
  add column if not exists fms_slot_min int not null default 30,
  add column if not exists fms_min_notice_hours int not null default 12,
  add column if not exists fms_horizon_days int not null default 14;
alter table public.coach_settings drop constraint if exists coach_settings_fms_window_check;
alter table public.coach_settings add constraint coach_settings_fms_window_check check (
  cardinality(fms_days) between 1 and 7 and fms_days <@ array[1,2,3,4,5,6,7]
  and array_position(fms_days, null) is null
  and fms_window_end > fms_window_start
  and extract(second from fms_window_start) = 0 and extract(second from fms_window_end) = 0
  and fms_slot_min between 5 and 180 and fms_slot_min % 5 = 0
  and mod(extract(epoch from (fms_window_end - fms_window_start)), fms_slot_min * 60) = 0
  and fms_min_notice_hours between 0 and 720 and fms_horizon_days between 1 and 90
);

create table if not exists public.fms_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null check (length(btrim(full_name)) between 1 and 120),
  email text not null check (length(email) between 3 and 254),
  starts_at timestamptz not null,
  duration_min int not null default 30 check (duration_min between 5 and 180),
  visitor_timezone text not null check (private.is_valid_iana_timezone(visitor_timezone)),
  preferred_language text not null check (preferred_language in ('en', 'tr')),
  status text not null default 'booked' check (status in ('booked', 'cancelled', 'completed', 'no_show')),
  admin_note text check (admin_note is null or length(admin_note) <= 4000)
);
create unique index if not exists fms_bookings_booked_start_uidx
  on public.fms_bookings(starts_at) where status = 'booked';
create index if not exists fms_bookings_status_start_idx on public.fms_bookings(status, starts_at);
alter table public.fms_bookings enable row level security;
revoke all on public.fms_bookings from public, anon, authenticated;
grant select, update on public.fms_bookings to authenticated;
grant all on public.fms_bookings to service_role;
drop policy if exists fms_bookings_staff_select on public.fms_bookings;
create policy fms_bookings_staff_select on public.fms_bookings for select to authenticated
  using (public.is_staff());
drop policy if exists fms_bookings_staff_update on public.fms_bookings;
create policy fms_bookings_staff_update on public.fms_bookings for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
-- No anonymous/client policy or direct authenticated INSERT grant.
-- Existing coach_settings staff policies govern the new FMS fields.
commit;
