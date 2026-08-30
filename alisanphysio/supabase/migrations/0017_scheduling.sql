-- =============================================================================
-- AlisanPhysio — real appointments, scheduling modes, timezones, and reminders.
--
-- Run manually AFTER 0016_nutrition_quantities.sql. Do not run automatically.
-- Safe/idempotent: the legacy availability workflow is renamed once and kept
-- intact; all new objects can be recreated without duplicating data.
--
-- SECURITY
--   * All user-facing tables have RLS enabled and policies are scoped to the
--     authenticated role.
--   * Privileged implementations live in the unexposed private schema.
--   * Public RPCs are SECURITY INVOKER wrappers with narrowly granted execute.
--   * No RLS or policy on unrelated application tables is changed.
--
-- TIME
--   timestamptz stores an instant (normalized internally by PostgreSQL). The
--   profile and coach timezone columns store IANA zone names for presentation
--   and wall-clock recurrence calculations in the application.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Preserve the old availability-request workflow losslessly.
--
-- The old availability_slots rows are client-authored date + free-text ranges;
-- they are not coach-published bookable instants. Rename both old tables rather
-- than silently reinterpreting a range in an unknown timezone as an appointment.
-- -----------------------------------------------------------------------------
do $legacy$
begin
  if to_regclass('public.availability_slots') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'availability_slots'
         and column_name = 'request_id'
     ) then
    if to_regclass('public.legacy_availability_slots') is not null then
      raise exception
        'Both availability_slots (legacy shape) and legacy_availability_slots exist; refusing an ambiguous rename.';
    end if;
    alter table public.availability_slots rename to legacy_availability_slots;
  end if;

  if to_regclass('public.availability_requests') is not null then
    if to_regclass('public.legacy_availability_requests') is not null then
      raise exception
        'Both availability_requests and legacy_availability_requests exist; refusing an ambiguous rename.';
    end if;
    alter table public.availability_requests rename to legacy_availability_requests;
  end if;
end
$legacy$;

-- Rename legacy constraints/indexes whose schema-global names would otherwise
-- collide with the replacement availability_slots table.
do $legacy_names$
begin
  if to_regclass('public.legacy_availability_slots') is not null then
    if exists (
      select 1 from pg_constraint
      where conrelid = 'public.legacy_availability_slots'::regclass
        and conname = 'availability_slots_pkey'
    ) and not exists (
      select 1 from pg_constraint
      where conrelid = 'public.legacy_availability_slots'::regclass
        and conname = 'legacy_availability_slots_pkey'
    ) then
      alter table public.legacy_availability_slots
        rename constraint availability_slots_pkey to legacy_availability_slots_pkey;
    end if;

    if exists (
      select 1 from pg_constraint
      where conrelid = 'public.legacy_availability_slots'::regclass
        and conname = 'availability_slots_request_id_fkey'
    ) and not exists (
      select 1 from pg_constraint
      where conrelid = 'public.legacy_availability_slots'::regclass
        and conname = 'legacy_availability_slots_request_id_fkey'
    ) then
      alter table public.legacy_availability_slots
        rename constraint availability_slots_request_id_fkey
        to legacy_availability_slots_request_id_fkey;
    end if;

    if to_regclass('public.availability_slots_request_idx') is not null
       and to_regclass('public.legacy_availability_slots_request_idx') is null then
      alter index public.availability_slots_request_idx
        rename to legacy_availability_slots_request_idx;
    end if;

    -- The superseded workflow is historical. Clients retain read access to
    -- their own submitted ranges, but can no longer mutate the archive.
    drop policy if exists "availability_slots_insert_own"
      on public.legacy_availability_slots;
    drop policy if exists "availability_slots_update_own"
      on public.legacy_availability_slots;
    drop policy if exists "availability_slots_delete_own"
      on public.legacy_availability_slots;

    comment on table public.legacy_availability_slots is
      'Archived client availability-range responses from migration 0013; preserved verbatim and intentionally not converted to appointment instants.';
  end if;

  if to_regclass('public.legacy_availability_requests') is not null then
    if exists (
      select 1 from pg_constraint
      where conrelid = 'public.legacy_availability_requests'::regclass
        and conname = 'availability_requests_pkey'
    ) and not exists (
      select 1 from pg_constraint
      where conrelid = 'public.legacy_availability_requests'::regclass
        and conname = 'legacy_availability_requests_pkey'
    ) then
      alter table public.legacy_availability_requests
        rename constraint availability_requests_pkey
        to legacy_availability_requests_pkey;
    end if;

    if exists (
      select 1 from pg_constraint
      where conrelid = 'public.legacy_availability_requests'::regclass
        and conname = 'availability_requests_client_id_week_start_key'
    ) and not exists (
      select 1 from pg_constraint
      where conrelid = 'public.legacy_availability_requests'::regclass
        and conname = 'legacy_availability_requests_client_week_key'
    ) then
      alter table public.legacy_availability_requests
        rename constraint availability_requests_client_id_week_start_key
        to legacy_availability_requests_client_week_key;
    end if;

    if to_regclass('public.availability_requests_client_idx') is not null
       and to_regclass('public.legacy_availability_requests_client_idx') is null then
      alter index public.availability_requests_client_idx
        rename to legacy_availability_requests_client_idx;
    end if;
    if to_regclass('public.availability_requests_week_idx') is not null
       and to_regclass('public.legacy_availability_requests_week_idx') is null then
      alter index public.availability_requests_week_idx
        rename to legacy_availability_requests_week_idx;
    end if;

    comment on table public.legacy_availability_requests is
      'Archived availability-request headers from migration 0013; retained with their response rows for historical reference.';
  end if;
end
$legacy_names$;

-- -----------------------------------------------------------------------------
-- 2. Private implementation schema and IANA timezone validation.
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create or replace function private.is_valid_iana_timezone(p_timezone text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    p_timezone is not null
    and (p_timezone = 'UTC' or position('/' in p_timezone) > 0)
    and exists (
      select 1
      from pg_catalog.pg_timezone_names tz
      where tz.name = p_timezone
    );
$function$;

revoke all on function private.is_valid_iana_timezone(text) from public;
revoke all on function private.is_valid_iana_timezone(text) from anon;

-- Authenticated profile/settings writes must be able to evaluate CHECKs that
-- call the validator. The private schema is not in PostgREST's exposed schemas.
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_valid_iana_timezone(text)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Viewer timezone and single-row coach scheduling settings.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists timezone text;

do $profile_timezone_constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_timezone_check'
  ) then
    alter table public.profiles
      add constraint profiles_timezone_check
      check (
        timezone is null
        or private.is_valid_iana_timezone(timezone)
      ) not valid;
  end if;
  alter table public.profiles validate constraint profiles_timezone_check;
end
$profile_timezone_constraint$;

comment on column public.profiles.timezone is
  'Viewer IANA timezone used to render UTC appointment instants; null until the user accepts or selects a browser-detected zone.';

create table if not exists public.coach_settings (
  singleton             boolean primary key default true,
  coach_id              uuid references public.profiles (id) on delete set null,
  scheduling_mode       text not null default 'coach_slots',
  default_duration_min  integer not null default 45,
  timezone              text not null default 'Europe/Istanbul',

  constraint coach_settings_singleton_check check (singleton),
  constraint coach_settings_mode_check
    check (scheduling_mode in ('coach_slots', 'client_proposal')),
  constraint coach_settings_duration_check
    check (default_duration_min between 5 and 480),
  constraint coach_settings_timezone_check
    check (private.is_valid_iana_timezone(timezone))
);

insert into public.coach_settings (singleton, coach_id)
values (
  true,
  (
    select p.id
    from public.profiles p
    where p.role = 'admin'
    order by p.created_at, p.id
    limit 1
  )
)
on conflict (singleton) do nothing;

comment on table public.coach_settings is
  'Exactly one row (singleton=true) controlling the active booking mode, default duration, coach identity, and coach IANA timezone.';

-- -----------------------------------------------------------------------------
-- 4. Scheduling tables.
-- -----------------------------------------------------------------------------
create table if not exists public.availability_slots (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null
                  default auth.uid(),
  starts_at     timestamptz not null,
  duration_min  integer not null default 45,
  status        text not null default 'open',
  note          text,

  constraint availability_slots_duration_check
    check (duration_min between 5 and 480),
  constraint availability_slots_status_check
    check (status in ('open', 'booked', 'closed'))
);

create table if not exists public.client_proposals (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  client_id           uuid not null references public.profiles (id) on delete cascade,
  proposal_group_id   uuid not null default gen_random_uuid(),
  proposed_start      timestamptz not null,
  note                text,
  status              text not null default 'pending',
  decision_note       text,
  decided_at          timestamptz,
  accepted_appointment_id uuid,

  constraint client_proposals_status_check
    check (status in ('pending', 'accepted', 'declined')),
  constraint client_proposals_future_at_creation_check
    check (proposed_start > created_at),
  constraint client_proposals_decision_shape_check
    check (
      (status = 'pending'
        and decision_note is null
        and decided_at is null
        and accepted_appointment_id is null)
      or
      (status = 'accepted'
        and decided_at is not null
        and accepted_appointment_id is not null)
      or
      (status = 'declined'
        and decided_at is not null
        and accepted_appointment_id is null)
    )
);

-- A submission may contain several alternative times. The shared group id lets
-- one acceptance atomically resolve its sibling alternatives. Existing rows
-- (including a partially applied earlier version of this migration) each become
-- their own one-time group rather than being combined by guesswork.
alter table public.client_proposals
  add column if not exists proposal_group_id uuid;
update public.client_proposals
set proposal_group_id = gen_random_uuid()
where proposal_group_id is null;
alter table public.client_proposals
  alter column proposal_group_id set default gen_random_uuid(),
  alter column proposal_group_id set not null;

create table if not exists public.appointments (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  client_id         uuid not null references public.profiles (id) on delete cascade,
  coach_id          uuid references public.profiles (id) on delete set null,
  slot_id           uuid references public.availability_slots (id) on delete set null,
  starts_at         timestamptz not null,
  duration_min      integer not null default 45,
  status            text not null default 'pending',
  meeting_url       text,
  agenda            text,
  coach_note        text,
  cancelled_by      text,
  cancelled_reason  text,
  cancelled_at      timestamptz,

  constraint appointments_duration_check
    check (duration_min between 5 and 480),
  constraint appointments_status_check
    check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  constraint appointments_cancelled_by_check
    check (cancelled_by in ('client', 'coach')),
  constraint appointments_cancellation_shape_check
    check (
      (status = 'cancelled'
        and cancelled_by is not null
        and cancelled_at is not null)
      or
      (status <> 'cancelled'
        and cancelled_by is null
        and cancelled_reason is null
        and cancelled_at is null)
    ),
  constraint appointments_meeting_url_check
    check (
      meeting_url is null
      or meeting_url ~* '^https://[^[:space:]]+$'
    )
);

-- Link an accepted proposal to exactly one resulting appointment. Kept on the
-- proposal so slot and direct appointments retain the requested compact shape.
do $proposal_appointment_fk$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.client_proposals'::regclass
      and conname = 'client_proposals_accepted_appointment_fkey'
  ) then
    alter table public.client_proposals
      add constraint client_proposals_accepted_appointment_fkey
      foreign key (accepted_appointment_id)
      references public.appointments (id)
      on delete restrict
      not valid;
  end if;
  alter table public.client_proposals
    validate constraint client_proposals_accepted_appointment_fkey;
end
$proposal_appointment_fk$;

create unique index if not exists client_proposals_accepted_appointment_uidx
  on public.client_proposals (accepted_appointment_id)
  where accepted_appointment_id is not null;

create index if not exists availability_slots_status_starts_idx
  on public.availability_slots (status, starts_at);
create index if not exists availability_slots_starts_idx
  on public.availability_slots (starts_at);

create index if not exists appointments_client_starts_idx
  on public.appointments (client_id, starts_at desc);
create index if not exists appointments_status_starts_idx
  on public.appointments (status, starts_at);
create index if not exists appointments_coach_starts_idx
  on public.appointments (coach_id, starts_at desc);

-- At most one non-cancelled appointment may own a slot. Cancelled history is
-- retained while the reopened slot can be booked into a new appointment.
create unique index if not exists appointments_one_active_per_slot_uidx
  on public.appointments (slot_id)
  where slot_id is not null and status <> 'cancelled';

create index if not exists client_proposals_client_starts_idx
  on public.client_proposals (client_id, proposed_start desc);
create index if not exists client_proposals_status_starts_idx
  on public.client_proposals (status, proposed_start);
create index if not exists client_proposals_group_idx
  on public.client_proposals (client_id, proposal_group_id, status);
create unique index if not exists client_proposals_one_accepted_per_group_uidx
  on public.client_proposals (client_id, proposal_group_id)
  where status = 'accepted';

comment on column public.availability_slots.starts_at is
  'Absolute appointment start instant (timestamptz); clients render it in their own IANA timezone.';
comment on column public.appointments.starts_at is
  'Absolute appointment start instant (timestamptz); never a timezone-free wall-clock string.';
comment on column public.client_proposals.proposed_start is
  'Absolute proposed instant (timestamptz) converted from the client-selected wall time and IANA timezone.';
comment on column public.appointments.coach_id is
  'Assigned staff member for targeted cancellation notifications and coach reminders.';

-- -----------------------------------------------------------------------------
-- 5. Appointment reminders use the existing notifications table.
-- -----------------------------------------------------------------------------
alter table public.notifications
  add column if not exists appointment_id uuid,
  add column if not exists reminder_type text;

do $notification_appointment_constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_appointment_id_fkey'
  ) then
    alter table public.notifications
      add constraint notifications_appointment_id_fkey
      foreign key (appointment_id)
      references public.appointments (id)
      on delete cascade
      not valid;
  end if;
  alter table public.notifications
    validate constraint notifications_appointment_id_fkey;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_reminder_type_check'
  ) then
    alter table public.notifications
      add constraint notifications_reminder_type_check
      check (reminder_type is null or reminder_type in ('24h', '12h'))
      not valid;
  end if;
  alter table public.notifications
    validate constraint notifications_reminder_type_check;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_appointment_shape_check'
  ) then
    alter table public.notifications
      add constraint notifications_appointment_shape_check
      check (
        (type = 'appointment_reminder'
          and appointment_id is not null
          and reminder_type is not null)
        or
        (type = 'appointment_cancelled'
          and appointment_id is not null
          and reminder_type is null)
        or
        (type not in ('appointment_reminder', 'appointment_cancelled')
          and appointment_id is null
          and reminder_type is null)
      ) not valid;
  end if;
  alter table public.notifications
    validate constraint notifications_appointment_shape_check;
end
$notification_appointment_constraints$;

-- This exact database uniqueness is the first line of duplicate protection.
create unique index if not exists notifications_appointment_reminder_uidx
  on public.notifications (user_id, appointment_id, reminder_type)
  where appointment_id is not null and reminder_type is not null;

-- A durable private ledger makes "ever" literal even if a user later deletes a
-- notification through the pre-existing notification delete policy.
create table if not exists private.appointment_reminder_deliveries (
  appointment_id  uuid not null references public.appointments (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  reminder_type   text not null check (reminder_type in ('24h', '12h')),
  created_at      timestamptz not null default now(),
  primary key (appointment_id, user_id, reminder_type)
);

alter table private.appointment_reminder_deliveries enable row level security;
revoke all on table private.appointment_reminder_deliveries from public;
revoke all on table private.appointment_reminder_deliveries from anon;
revoke all on table private.appointment_reminder_deliveries from authenticated;

-- Retain every existing notification type while adding scheduling events.
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'membership_expiry',
      'missing_info',
      'weekly_review',
      'manual',
      'availability',
      'appointment_reminder',
      'appointment_cancelled'
    )
  );

-- -----------------------------------------------------------------------------
-- 6. RLS — mirrors the established is_staff() / auth.uid() conventions.
-- -----------------------------------------------------------------------------
alter table public.coach_settings    enable row level security;
alter table public.availability_slots enable row level security;
alter table public.appointments       enable row level security;
alter table public.client_proposals   enable row level security;

-- coach_settings: every authenticated viewer reads the active mode/timezone;
-- only staff can mutate the singleton.
drop policy if exists "coach_settings_select_authenticated"
  on public.coach_settings;
drop policy if exists "coach_settings_staff_all"
  on public.coach_settings;

create policy "coach_settings_select_authenticated"
  on public.coach_settings
  for select
  to authenticated
  using (auth.uid() is not null);

create policy "coach_settings_staff_all"
  on public.coach_settings
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- availability_slots: staff full CRUD; a signed-in user sees open slots plus
-- the booked slot attached to their own non-cancelled appointment.
drop policy if exists "availability_slots_select_open_or_own_booked"
  on public.availability_slots;
drop policy if exists "availability_slots_staff_all"
  on public.availability_slots;

create policy "availability_slots_select_open_or_own_booked"
  on public.availability_slots
  for select
  to authenticated
  using (
    status = 'open'
    or exists (
      select 1
      from public.appointments a
      where a.slot_id = availability_slots.id
        and a.client_id = auth.uid()
        and a.status <> 'cancelled'
    )
  );

create policy "availability_slots_staff_all"
  on public.availability_slots
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- appointments: clients read only their own. Their sole table UPDATE path is a
-- transition of their own non-cancelled row to cancelled; the guard trigger
-- below prevents changing any other field in that same statement. Staff full
-- CRUD remains available through the matching staff policy.
drop policy if exists "appointments_select_own"
  on public.appointments;
drop policy if exists "appointments_cancel_own"
  on public.appointments;
drop policy if exists "appointments_staff_all"
  on public.appointments;

create policy "appointments_select_own"
  on public.appointments
  for select
  to authenticated
  using (client_id = auth.uid());

create policy "appointments_cancel_own"
  on public.appointments
  for update
  to authenticated
  using (
    client_id = auth.uid()
    and status <> 'cancelled'
  )
  with check (
    client_id = auth.uid()
    and status = 'cancelled'
    and cancelled_by = 'client'
    and cancelled_at is not null
  );

create policy "appointments_staff_all"
  on public.appointments
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- client_proposals: clients can only read and insert their own pending rows;
-- staff manage every proposal. There is no client UPDATE or DELETE policy.
drop policy if exists "client_proposals_select_own"
  on public.client_proposals;
drop policy if exists "client_proposals_insert_own"
  on public.client_proposals;
drop policy if exists "client_proposals_staff_all"
  on public.client_proposals;

create policy "client_proposals_select_own"
  on public.client_proposals
  for select
  to authenticated
  using (client_id = auth.uid());

create policy "client_proposals_insert_own"
  on public.client_proposals
  for insert
  to authenticated
  with check (
    client_id = auth.uid()
    and status = 'pending'
    and decision_note is null
    and decided_at is null
    and accepted_appointment_id is null
  );

create policy "client_proposals_staff_all"
  on public.client_proposals
  for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Explicit table privileges work together with (and never replace) RLS.
revoke all on table public.coach_settings from public;
revoke all on table public.availability_slots from public;
revoke all on table public.appointments from public;
revoke all on table public.client_proposals from public;
revoke all on table public.coach_settings from anon;
revoke all on table public.availability_slots from anon;
revoke all on table public.appointments from anon;
revoke all on table public.client_proposals from anon;

grant select, insert, update, delete
  on table public.coach_settings to authenticated;
grant select, insert, update, delete
  on table public.availability_slots to authenticated;
-- Never grant the shared authenticated role SELECT on coach_note: database
-- roles do not distinguish staff/client, so RLS alone cannot hide one column
-- from an otherwise-visible client row. Clients receive the safe columns below;
-- staff obtain full rows through get_staff_appointments().
revoke select on table public.appointments from authenticated;
grant select (
  id,
  created_at,
  client_id,
  coach_id,
  slot_id,
  starts_at,
  duration_min,
  status,
  agenda,
  cancelled_by,
  cancelled_reason,
  cancelled_at
) on table public.appointments to authenticated;
grant insert, update, delete
  on table public.appointments to authenticated;
grant select, insert, update, delete
  on table public.client_proposals to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Invariant triggers.
-- -----------------------------------------------------------------------------
create or replace function private.appointments_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  slot_row public.availability_slots%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.slot_id is not null and new.status <> 'cancelled' then
      select s.*
      into slot_row
      from public.availability_slots s
      where s.id = new.slot_id
      for update;

      if not found or slot_row.status <> 'open' then
        raise exception 'slot_just_taken'
          using errcode = 'P0001',
                detail = 'The availability slot is no longer open.';
      end if;

      if new.starts_at is distinct from slot_row.starts_at
         or new.duration_min is distinct from slot_row.duration_min then
        raise exception 'appointment_slot_mismatch'
          using errcode = '22023',
                detail = 'A slot-backed appointment must use the slot start and duration.';
      end if;

      new.coach_id := coalesce(new.coach_id, slot_row.created_by);
    end if;

    if new.coach_id is null and actor_id is not null and public.is_staff() then
      new.coach_id := actor_id;
    end if;

    if new.status = 'cancelled' then
      new.cancelled_by := coalesce(
        new.cancelled_by,
        case when actor_id is not null and not public.is_staff()
          then 'client' else 'coach' end
      );
      new.cancelled_at := coalesce(new.cancelled_at, now());
    end if;

    return new;
  end if;

  -- Cancelled is terminal. Staff can still edit non-state metadata such as a
  -- coach note, but nobody can erase or rewrite the cancellation audit fields.
  if old.status = 'cancelled' then
    if new.status is distinct from old.status
       or new.cancelled_by is distinct from old.cancelled_by
       or new.cancelled_reason is distinct from old.cancelled_reason
       or new.cancelled_at is distinct from old.cancelled_at then
      raise exception 'cancelled_appointment_is_terminal'
        using errcode = '22023';
    end if;
  end if;

  if actor_id is not null and not public.is_staff() then
    if old.client_id is distinct from actor_id then
      raise exception 'appointment_access_denied'
        using errcode = '42501';
    end if;
    if old.status = 'cancelled' or new.status <> 'cancelled' then
      raise exception 'clients_may_only_cancel_appointments'
        using errcode = '42501';
    end if;

    -- Compare every column except the four fields involved in cancellation.
    -- This prevents a client from changing starts_at, meeting_url, coach_note,
    -- client_id, or any future column while also setting status=cancelled.
    if (to_jsonb(new) - array[
          'status', 'cancelled_by', 'cancelled_reason', 'cancelled_at'
        ]) is distinct from
       (to_jsonb(old) - array[
          'status', 'cancelled_by', 'cancelled_reason', 'cancelled_at'
        ]) then
      raise exception 'clients_may_only_cancel_appointments'
        using errcode = '42501';
    end if;

    new.cancelled_by := 'client';
    new.cancelled_at := now();
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_by := coalesce(new.cancelled_by, 'coach');
    new.cancelled_at := now();
  end if;

  return new;
end;
$function$;

revoke all on function private.appointments_before_write() from public;
revoke all on function private.appointments_before_write() from anon;
revoke all on function private.appointments_before_write() from authenticated;

drop trigger if exists appointments_before_write on public.appointments;
create trigger appointments_before_write
  before insert or update on public.appointments
  for each row execute function private.appointments_before_write();

create or replace function private.appointment_slot_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.slot_id is not null and new.status <> 'cancelled' then
    update public.availability_slots
    set status = 'booked'
    where id = new.slot_id
      and status = 'open';

    if not found then
      raise exception 'slot_just_taken'
        using errcode = 'P0001',
              detail = 'The availability slot is no longer open.';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function private.appointment_slot_after_insert() from public;
revoke all on function private.appointment_slot_after_insert() from anon;
revoke all on function private.appointment_slot_after_insert() from authenticated;

drop trigger if exists appointment_slot_after_insert on public.appointments;
create trigger appointment_slot_after_insert
  after insert on public.appointments
  for each row execute function private.appointment_slot_after_insert();

create or replace function private.appointment_after_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status <> 'cancelled' and new.status = 'cancelled' then
    if new.slot_id is not null then
      update public.availability_slots
      set status = 'open'
      where id = new.slot_id;
    end if;

    if new.cancelled_by = 'client' then
      insert into public.notifications (
        user_id,
        type,
        title,
        body,
        link,
        dedupe_key,
        appointment_id
      )
      select
        p.id,
        'appointment_cancelled',
        case when p.language = 'tr'
          then 'Randevu iptal edildi'
          else 'Appointment cancelled'
        end,
        case when p.language = 'tr'
          then 'Bir randevu danışanınız tarafından iptal edildi.'
          else 'An appointment was cancelled by your client.'
        end || case
          when nullif(btrim(new.cancelled_reason), '') is null then ''
          when p.language = 'tr' then ' Sebep: ' || btrim(new.cancelled_reason)
          else ' Reason: ' || btrim(new.cancelled_reason)
        end,
        '/admin/availability',
        'appointment_cancelled:' || new.id::text,
        new.id
      from public.profiles p
      where
        (new.coach_id is not null and p.id = new.coach_id)
        or
        (new.coach_id is null and p.role in ('admin', 'manager'))
      on conflict (user_id, dedupe_key) do nothing;
    else
      insert into public.notifications (
        user_id,
        type,
        title,
        body,
        link,
        dedupe_key,
        appointment_id
      )
      select
        p.id,
        'appointment_cancelled',
        case when p.language = 'tr'
          then 'Randevunuz iptal edildi'
          else 'Your appointment was cancelled'
        end,
        case when p.language = 'tr'
          then 'Randevunuz koçunuz tarafından iptal edildi.'
          else 'Your appointment was cancelled by your coach.'
        end || case
          when nullif(btrim(new.cancelled_reason), '') is null then ''
          when p.language = 'tr' then ' Sebep: ' || btrim(new.cancelled_reason)
          else ' Reason: ' || btrim(new.cancelled_reason)
        end,
        '/dashboard/availability',
        'appointment_cancelled:' || new.id::text,
        new.id
      from public.profiles p
      where p.id = new.client_id
      on conflict (user_id, dedupe_key) do nothing;
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.appointment_after_cancel() from public;
revoke all on function private.appointment_after_cancel() from anon;
revoke all on function private.appointment_after_cancel() from authenticated;

drop trigger if exists appointment_after_cancel on public.appointments;
create trigger appointment_after_cancel
  after update of status on public.appointments
  for each row execute function private.appointment_after_cancel();

-- Preserve the required direct client INSERT policy (including atomic batch
-- inserts) while enforcing that client proposals can only be created in the
-- client_proposal mode and only for future instants.
create or replace function private.client_proposals_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  current_mode text;
begin
  if actor_id is not null and not public.is_staff() then
    if new.client_id is distinct from actor_id then
      raise exception 'proposal_access_denied'
        using errcode = '42501';
    end if;

    select cs.scheduling_mode
    into current_mode
    from public.coach_settings cs
    where cs.singleton = true;

    if current_mode is distinct from 'client_proposal' then
      raise exception 'scheduling_mode_not_client_proposal'
        using errcode = 'P0001';
    end if;
    if new.proposed_start <= now() then
      raise exception 'proposal_must_be_in_the_future'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.client_proposals_before_insert() from public;
revoke all on function private.client_proposals_before_insert() from anon;
revoke all on function private.client_proposals_before_insert() from authenticated;

drop trigger if exists client_proposals_before_insert on public.client_proposals;
create trigger client_proposals_before_insert
  before insert on public.client_proposals
  for each row execute function private.client_proposals_before_insert();

-- -----------------------------------------------------------------------------
-- 8. Private atomic implementations.
-- -----------------------------------------------------------------------------
create or replace function private.create_client_proposal_impl(
  p_proposed_start timestamptz,
  p_note text default null
)
returns public.client_proposals
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  current_mode text;
  result_row public.client_proposals%rowtype;
begin
  if actor_id is null
     or not exists (
       select 1
       from public.profiles p
       where p.id = actor_id and p.role = 'client'
     ) then
    raise exception 'client_authentication_required'
      using errcode = '42501';
  end if;

  select cs.scheduling_mode
  into current_mode
  from public.coach_settings cs
  where cs.singleton = true;

  if current_mode is distinct from 'client_proposal' then
    raise exception 'scheduling_mode_not_client_proposal'
      using errcode = 'P0001';
  end if;
  if p_proposed_start is null or p_proposed_start <= now() then
    raise exception 'proposal_must_be_in_the_future'
      using errcode = '22023';
  end if;

  insert into public.client_proposals (
    client_id,
    proposed_start,
    note
  )
  values (
    actor_id,
    p_proposed_start,
    nullif(btrim(p_note), '')
  )
  returning * into result_row;

  return result_row;
end;
$function$;

create or replace function private.book_availability_slot_impl(
  p_slot_id uuid,
  p_agenda text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  slot_row public.availability_slots%rowtype;
  result_row public.appointments%rowtype;
  current_mode text;
  default_coach_id uuid;
begin
  if actor_id is null
     or public.is_staff()
     or not exists (
       select 1
       from public.profiles p
       where p.id = actor_id and p.role = 'client'
     ) then
    raise exception 'client_authentication_required'
      using errcode = '42501';
  end if;

  select cs.scheduling_mode, cs.coach_id
  into current_mode, default_coach_id
  from public.coach_settings cs
  where cs.singleton = true;

  if current_mode is distinct from 'coach_slots' then
    raise exception 'scheduling_mode_not_coach_slots'
      using errcode = 'P0001';
  end if;

  select s.*
  into slot_row
  from public.availability_slots s
  where s.id = p_slot_id
  for update;

  if not found
     or slot_row.status <> 'open'
     or slot_row.starts_at <= now() then
    raise exception 'slot_just_taken'
      using errcode = 'P0001',
            detail = 'The availability slot was booked or closed before this request completed.';
  end if;

  begin
    insert into public.appointments (
      client_id,
      coach_id,
      slot_id,
      starts_at,
      duration_min,
      status,
      agenda
    )
    values (
      actor_id,
      coalesce(slot_row.created_by, default_coach_id),
      slot_row.id,
      slot_row.starts_at,
      slot_row.duration_min,
      'pending',
      nullif(btrim(p_agenda), '')
    )
    returning * into result_row;
  exception
    when unique_violation then
      raise exception 'slot_just_taken'
        using errcode = 'P0001',
              detail = 'Another client booked this slot first.';
  end;

  return result_row;
end;
$function$;

create or replace function private.accept_client_proposal_impl(
  p_proposal_id uuid,
  p_duration_min integer default null,
  p_agenda text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  proposal_row public.client_proposals%rowtype;
  result_row public.appointments%rowtype;
  chosen_duration integer;
  target_client_id uuid;
  target_group_id uuid;
begin
  if actor_id is null or not public.is_staff() then
    raise exception 'staff_access_required'
      using errcode = '42501';
  end if;

  -- Read the immutable group identity first, then lock every alternative in a
  -- deterministic order. Concurrent accepts from the same submission now
  -- serialize instead of deadlocking after each transaction locks one sibling.
  select cp.*
  into proposal_row
  from public.client_proposals cp
  where cp.id = p_proposal_id;

  if not found then
    raise exception 'proposal_not_found'
      using errcode = 'P0002';
  end if;
  target_client_id := proposal_row.client_id;
  target_group_id := proposal_row.proposal_group_id;

  perform cp.id
  from public.client_proposals cp
  where cp.client_id = target_client_id
    and cp.proposal_group_id = target_group_id
  order by cp.id
  for update;

  select cp.*
  into proposal_row
  from public.client_proposals cp
  where cp.id = p_proposal_id
    and cp.client_id = target_client_id
    and cp.proposal_group_id = target_group_id;

  if not found then
    raise exception 'proposal_already_decided'
      using errcode = 'P0001';
  end if;

  if proposal_row.status <> 'pending' then
    raise exception 'proposal_already_decided'
      using errcode = 'P0001';
  end if;
  if proposal_row.proposed_start <= now() then
    raise exception 'proposal_is_in_the_past'
      using errcode = '22023';
  end if;

  select coalesce(
    p_duration_min,
    (select cs.default_duration_min
     from public.coach_settings cs
     where cs.singleton = true),
    45
  ) into chosen_duration;

  if chosen_duration not between 5 and 480 then
    raise exception 'invalid_appointment_duration'
      using errcode = '22023';
  end if;

  insert into public.appointments (
    client_id,
    coach_id,
    starts_at,
    duration_min,
    status,
    agenda
  )
  values (
    proposal_row.client_id,
    actor_id,
    proposal_row.proposed_start,
    chosen_duration,
    'confirmed',
    nullif(btrim(p_agenda), '')
  )
  returning * into result_row;

  update public.client_proposals
  set status = 'accepted',
      decided_at = now(),
      accepted_appointment_id = result_row.id
  where id = proposal_row.id;

  -- The client submitted these as alternatives. Once one is accepted, every
  -- still-pending sibling is resolved in this same transaction so a stale
  -- admin screen cannot accept two times from one submission.
  update public.client_proposals
  set status = 'declined',
      decision_note = null,
      decided_at = now()
  where client_id = proposal_row.client_id
    and proposal_group_id = proposal_row.proposal_group_id
    and id <> proposal_row.id
    and status = 'pending';

  return result_row;
end;
$function$;

create or replace function private.decline_client_proposal_impl(
  p_proposal_id uuid,
  p_reason text default null
)
returns public.client_proposals
language plpgsql
security definer
set search_path = ''
as $function$
declare
  proposal_row public.client_proposals%rowtype;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'staff_access_required'
      using errcode = '42501';
  end if;

  select cp.*
  into proposal_row
  from public.client_proposals cp
  where cp.id = p_proposal_id
  for update;

  if not found then
    raise exception 'proposal_not_found'
      using errcode = 'P0002';
  end if;
  if proposal_row.status <> 'pending' then
    raise exception 'proposal_already_decided'
      using errcode = 'P0001';
  end if;

  update public.client_proposals
  set status = 'declined',
      decision_note = nullif(btrim(p_reason), ''),
      decided_at = now()
  where id = proposal_row.id
  returning * into proposal_row;

  return proposal_row;
end;
$function$;

create or replace function private.cancel_appointment_impl(
  p_appointment_id uuid,
  p_reason text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  appointment_row public.appointments%rowtype;
  actor_is_staff boolean;
begin
  if actor_id is null then
    raise exception 'authentication_required'
      using errcode = '42501';
  end if;

  actor_is_staff := public.is_staff();

  select a.*
  into appointment_row
  from public.appointments a
  where a.id = p_appointment_id
    and (actor_is_staff or a.client_id = actor_id)
  for update;

  if not found then
    raise exception 'appointment_not_found'
      using errcode = 'P0002';
  end if;
  -- Idempotent retry: no second notification and no rewritten audit timestamp.
  if appointment_row.status = 'cancelled' then
    if not actor_is_staff then
      appointment_row.meeting_url := null;
      appointment_row.coach_note := null;
    end if;
    return appointment_row;
  end if;

  update public.appointments
  set status = 'cancelled',
      cancelled_by = case when actor_is_staff then 'coach' else 'client' end,
      cancelled_reason = nullif(btrim(p_reason), ''),
      cancelled_at = now()
  where id = appointment_row.id
  returning * into appointment_row;

  if not actor_is_staff then
    appointment_row.meeting_url := null;
    appointment_row.coach_note := null;
  end if;

  return appointment_row;
end;
$function$;

-- Client-safe appointment reader. meeting_url is projected only during the
-- confirmed appointment's join window; coach_note is not part of the result.
create or replace function private.get_own_appointments_impl(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  id uuid,
  created_at timestamptz,
  client_id uuid,
  coach_id uuid,
  slot_id uuid,
  starts_at timestamptz,
  duration_min integer,
  status text,
  meeting_url text,
  agenda text,
  cancelled_by text,
  cancelled_reason text,
  cancelled_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'authentication_required'
      using errcode = '42501';
  end if;

  return query
  select
    a.id,
    a.created_at,
    a.client_id,
    a.coach_id,
    a.slot_id,
    a.starts_at,
    a.duration_min,
    a.status,
    case
      when a.status = 'confirmed'
        and now() >= a.starts_at - interval '30 minutes'
        and now() <= a.starts_at + a.duration_min * interval '1 minute'
      then a.meeting_url
      else null
    end as meeting_url,
    a.agenda,
    a.cancelled_by,
    a.cancelled_reason,
    a.cancelled_at
  from public.appointments a
  where a.client_id = actor_id
    and (p_from is null or a.starts_at >= p_from)
    and (p_to is null or a.starts_at < p_to)
  order by a.starts_at;
end;
$function$;

-- Full-row staff reader. This is the only authenticated read interface that
-- exposes coach_note and the unmasked meeting_url.
create or replace function private.get_staff_appointments_impl(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_client_id uuid default null,
  p_appointment_id uuid default null
)
returns setof public.appointments
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'staff_access_required'
      using errcode = '42501';
  end if;

  return query
  select a.*
  from public.appointments a
  where (p_from is null or a.starts_at >= p_from)
    and (p_to is null or a.starts_at < p_to)
    and (p_client_id is null or a.client_id = p_client_id)
    and (p_appointment_id is null or a.id = p_appointment_id)
  order by a.starts_at;
end;
$function$;

create or replace function private.generate_due_appointment_reminders_impl()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  actor_language text;
  actor_is_staff boolean;
  inserted_count integer := 0;
begin
  if actor_id is null then
    return 0;
  end if;

  select coalesce(p.language, 'en'), p.role in ('admin', 'manager')
  into actor_language, actor_is_staff
  from public.profiles p
  where p.id = actor_id;

  if not found then
    return 0;
  end if;

  with due_appointments as (
    select
      a.id as appointment_id,
      a.starts_at
    from public.appointments a
    where a.status in ('pending', 'confirmed')
      and a.starts_at > now()
      and a.starts_at <= now() + interval '24 hours'
      and (
        (not actor_is_staff and a.client_id = actor_id)
        or
        (actor_is_staff and (a.coach_id = actor_id or a.coach_id is null))
      )
    order by a.id
    for update of a
  ),
  due as (
    select
      a.appointment_id,
      reminder.reminder_type,
      reminder.window_end
    from due_appointments a
    cross join (
      values
        ('24h'::text, interval '24 hours'),
        ('12h'::text, interval '12 hours')
    ) as reminder(reminder_type, window_end)
    where a.starts_at <= now() + reminder.window_end
  ),
  claimed as (
    insert into private.appointment_reminder_deliveries (
      appointment_id,
      user_id,
      reminder_type
    )
    select d.appointment_id, actor_id, d.reminder_type
    from due d
    on conflict (appointment_id, user_id, reminder_type) do nothing
    returning appointment_id, reminder_type
  ),
  created as (
    insert into public.notifications (
      user_id,
      type,
      title,
      body,
      link,
      dedupe_key,
      appointment_id,
      reminder_type
    )
    select
      actor_id,
      'appointment_reminder',
      case
        when actor_language = 'tr' and c.reminder_type = '24h'
          then 'Randevuya 24 saat kaldı'
        when actor_language = 'tr'
          then 'Randevuya 12 saat kaldı'
        when c.reminder_type = '24h'
          then 'Appointment in 24 hours'
        else 'Appointment in 12 hours'
      end,
      case
        when actor_language = 'tr' and c.reminder_type = '24h'
          then 'Yaklaşan randevunuz 24 saat içinde başlayacak.'
        when actor_language = 'tr'
          then 'Yaklaşan randevunuz 12 saat içinde başlayacak.'
        when c.reminder_type = '24h'
          then 'Your upcoming appointment starts within 24 hours.'
        else 'Your upcoming appointment starts within 12 hours.'
      end,
      case when actor_is_staff
        then '/admin/availability'
        else '/dashboard/availability'
      end,
      'appointment_reminder:' || c.appointment_id::text || ':' || c.reminder_type,
      c.appointment_id,
      c.reminder_type
    from claimed c
    on conflict do nothing
    returning id
  )
  select count(*)::integer
  into inserted_count
  from created;

  return inserted_count;
end;
$function$;

-- Lock down all privileged implementations. The invoker wrappers require their
-- callers to have EXECUTE on these callees, but the private schema itself is
-- deliberately absent from PostgREST's exposed schema list.
revoke all on function private.create_client_proposal_impl(timestamptz, text) from public;
revoke all on function private.book_availability_slot_impl(uuid, text) from public;
revoke all on function private.accept_client_proposal_impl(uuid, integer, text) from public;
revoke all on function private.decline_client_proposal_impl(uuid, text) from public;
revoke all on function private.cancel_appointment_impl(uuid, text) from public;
revoke all on function private.get_own_appointments_impl(timestamptz, timestamptz) from public;
revoke all on function private.get_staff_appointments_impl(timestamptz, timestamptz, uuid, uuid) from public;
revoke all on function private.generate_due_appointment_reminders_impl() from public;

revoke all on function private.create_client_proposal_impl(timestamptz, text) from anon;
revoke all on function private.book_availability_slot_impl(uuid, text) from anon;
revoke all on function private.accept_client_proposal_impl(uuid, integer, text) from anon;
revoke all on function private.decline_client_proposal_impl(uuid, text) from anon;
revoke all on function private.cancel_appointment_impl(uuid, text) from anon;
revoke all on function private.get_own_appointments_impl(timestamptz, timestamptz) from anon;
revoke all on function private.get_staff_appointments_impl(timestamptz, timestamptz, uuid, uuid) from anon;
revoke all on function private.generate_due_appointment_reminders_impl() from anon;

grant execute on function private.create_client_proposal_impl(timestamptz, text)
  to authenticated;
grant execute on function private.book_availability_slot_impl(uuid, text)
  to authenticated;
grant execute on function private.accept_client_proposal_impl(uuid, integer, text)
  to authenticated;
grant execute on function private.decline_client_proposal_impl(uuid, text)
  to authenticated;
grant execute on function private.cancel_appointment_impl(uuid, text)
  to authenticated;
grant execute on function private.get_own_appointments_impl(timestamptz, timestamptz)
  to authenticated;
grant execute on function private.get_staff_appointments_impl(timestamptz, timestamptz, uuid, uuid)
  to authenticated;
grant execute on function private.generate_due_appointment_reminders_impl()
  to authenticated;

-- -----------------------------------------------------------------------------
-- 9. Public, SECURITY INVOKER RPC wrappers (the only exposed functions).
-- -----------------------------------------------------------------------------
create or replace function public.create_client_proposal(
  p_proposed_start timestamptz,
  p_note text default null
)
returns public.client_proposals
language sql
security invoker
set search_path = ''
as $function$
  select private.create_client_proposal_impl(p_proposed_start, p_note);
$function$;

create or replace function public.book_availability_slot(
  p_slot_id uuid,
  p_agenda text default null
)
returns public.appointments
language sql
security invoker
set search_path = ''
as $function$
  select private.book_availability_slot_impl(p_slot_id, p_agenda);
$function$;

create or replace function public.accept_client_proposal(
  p_proposal_id uuid,
  p_duration_min integer default null,
  p_agenda text default null
)
returns public.appointments
language sql
security invoker
set search_path = ''
as $function$
  select private.accept_client_proposal_impl(
    p_proposal_id,
    p_duration_min,
    p_agenda
  );
$function$;

create or replace function public.decline_client_proposal(
  p_proposal_id uuid,
  p_reason text default null
)
returns public.client_proposals
language sql
security invoker
set search_path = ''
as $function$
  select private.decline_client_proposal_impl(p_proposal_id, p_reason);
$function$;

create or replace function public.cancel_appointment(
  p_appointment_id uuid,
  p_reason text default null
)
returns public.appointments
language sql
security invoker
set search_path = ''
as $function$
  select private.cancel_appointment_impl(p_appointment_id, p_reason);
$function$;

create or replace function public.get_own_appointments(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  id uuid,
  created_at timestamptz,
  client_id uuid,
  coach_id uuid,
  slot_id uuid,
  starts_at timestamptz,
  duration_min integer,
  status text,
  meeting_url text,
  agenda text,
  cancelled_by text,
  cancelled_reason text,
  cancelled_at timestamptz
)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.get_own_appointments_impl(p_from, p_to);
$function$;

create or replace function public.get_staff_appointments(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_client_id uuid default null,
  p_appointment_id uuid default null
)
returns setof public.appointments
language sql
security invoker
set search_path = ''
as $function$
  select *
  from private.get_staff_appointments_impl(
    p_from,
    p_to,
    p_client_id,
    p_appointment_id
  );
$function$;

create or replace function public.generate_due_appointment_reminders()
returns integer
language sql
security invoker
set search_path = ''
as $function$
  select private.generate_due_appointment_reminders_impl();
$function$;

revoke all on function public.create_client_proposal(timestamptz, text) from public;
revoke all on function public.book_availability_slot(uuid, text) from public;
revoke all on function public.accept_client_proposal(uuid, integer, text) from public;
revoke all on function public.decline_client_proposal(uuid, text) from public;
revoke all on function public.cancel_appointment(uuid, text) from public;
revoke all on function public.get_own_appointments(timestamptz, timestamptz) from public;
revoke all on function public.get_staff_appointments(timestamptz, timestamptz, uuid, uuid) from public;
revoke all on function public.generate_due_appointment_reminders() from public;

revoke all on function public.create_client_proposal(timestamptz, text) from anon;
revoke all on function public.book_availability_slot(uuid, text) from anon;
revoke all on function public.accept_client_proposal(uuid, integer, text) from anon;
revoke all on function public.decline_client_proposal(uuid, text) from anon;
revoke all on function public.cancel_appointment(uuid, text) from anon;
revoke all on function public.get_own_appointments(timestamptz, timestamptz) from anon;
revoke all on function public.get_staff_appointments(timestamptz, timestamptz, uuid, uuid) from anon;
revoke all on function public.generate_due_appointment_reminders() from anon;

grant execute on function public.create_client_proposal(timestamptz, text)
  to authenticated;
grant execute on function public.book_availability_slot(uuid, text)
  to authenticated;
grant execute on function public.accept_client_proposal(uuid, integer, text)
  to authenticated;
grant execute on function public.decline_client_proposal(uuid, text)
  to authenticated;
grant execute on function public.cancel_appointment(uuid, text)
  to authenticated;
grant execute on function public.get_own_appointments(timestamptz, timestamptz)
  to authenticated;
grant execute on function public.get_staff_appointments(timestamptz, timestamptz, uuid, uuid)
  to authenticated;
grant execute on function public.generate_due_appointment_reminders()
  to authenticated;

-- -----------------------------------------------------------------------------
-- 10. Migration audit. This exposes counts only, never personal data.
--
-- No legacy row is converted automatically: its free-text range has no IANA
-- timezone and does not identify a single appointment instant. The rows remain
-- queryable in the two legacy tables under their inherited own/staff RLS.
-- -----------------------------------------------------------------------------
do $audit$
declare
  request_count bigint := 0;
  range_count bigint := 0;
begin
  if to_regclass('public.legacy_availability_requests') is not null then
    execute 'select count(*) from public.legacy_availability_requests'
      into request_count;
  end if;
  if to_regclass('public.legacy_availability_slots') is not null then
    execute 'select count(*) from public.legacy_availability_slots'
      into range_count;
  end if;

  raise notice
    'Scheduling migration audit: % legacy requests preserved; % legacy ranges preserved; 0 appointments/proposals synthesized (timezone-free ranges cannot identify exact UTC instants).',
    request_count,
    range_count;
end
$audit$;
