-- Run manually AFTER 0017. Do not deploy the new application before this migration.
begin;

-- INTENTIONAL DESTRUCTIVE CLEANUP OF TEST DATA: delete all old programmes
-- (program_days/exercises cascade) and all old reviews. Shared libraries and
-- day templates survive. Guarded by the old period column: reruns preserve
-- newly authored monthly data. The transaction makes conversion all-or-nothing.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'programs' and column_name = 'week_start_date') then
    if to_regclass('public.weekly_reviews') is not null then
      delete from public.weekly_reviews;
    end if;
    delete from public.programs;
  end if;
end $$;

alter table public.programs drop column if exists week_start_date;
alter table public.programs add column if not exists month_start_date date;
alter table public.programs add column if not exists kind text not null default 'client';
alter table public.programs alter column client_id drop not null;
alter table public.programs drop constraint if exists programs_kind_check;
alter table public.programs add constraint programs_kind_check check (kind in ('client', 'catalog'));
alter table public.programs drop constraint if exists programs_shape_check;
alter table public.programs add constraint programs_shape_check check (
  (kind = 'client' and client_id is not null and month_start_date is not null)
  or (kind = 'catalog' and client_id is null and month_start_date is null)
);
alter table public.programs drop constraint if exists programs_month_start_check;
alter table public.programs add constraint programs_month_start_check
  check (month_start_date is null or extract(day from month_start_date) = 1);
create unique index if not exists programs_client_month_uidx
  on public.programs(client_id, month_start_date) where kind = 'client';
create index if not exists programs_client_month_idx
  on public.programs(client_id, month_start_date desc);
create unique index if not exists programs_id_client_uidx on public.programs(id, client_id);

-- NULL = auth.uid() is UNKNOWN, never TRUE in a USING predicate. Explicit kind
-- checks also protect against future shape changes. No anonymous/public policy.
drop policy if exists programs_select_own on public.programs;
create policy programs_select_own on public.programs for select to authenticated
  using (kind = 'client' and client_id = auth.uid());
-- Existing staff policies on programmes, days and exercises remain in place.

do $$
begin
  if to_regclass('public.weekly_reviews') is not null then
    alter table public.weekly_reviews rename to program_reviews;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'program_reviews' and column_name = 'user_id') then
    alter table public.program_reviews rename column user_id to client_id;
  end if;
end $$;
alter table public.program_reviews drop column if exists week_start;
alter table public.program_reviews add column if not exists program_id uuid not null;

-- Rename inherited constraints/indexes/policies, including the primary key.
do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid = 'public.program_reviews'::regclass
    and conname like '%weekly%' loop
    execute format('alter table public.program_reviews rename constraint %I to %I',
      r.conname, replace(r.conname, 'weekly', 'program'));
  end loop;
  for r in select indexname from pg_indexes where schemaname = 'public'
    and tablename = 'program_reviews' and indexname like '%weekly%' loop
    execute format('alter index public.%I rename to %I', r.indexname, replace(r.indexname, 'weekly', 'program'));
  end loop;
  for r in select policyname from pg_policies where schemaname = 'public'
    and tablename = 'program_reviews' and policyname like '%weekly%' loop
    execute format('alter policy %I on public.program_reviews rename to %I',
      r.policyname, replace(r.policyname, 'weekly', 'program'));
  end loop;
end $$;
alter table public.program_reviews drop constraint if exists program_reviews_program_fkey;
alter table public.program_reviews add constraint program_reviews_program_fkey
  foreign key (program_id, client_id) references public.programs(id, client_id) on delete cascade;
-- The composite FK plus the programme shape CHECK enforces matching ownership
-- and excludes catalogue programmes (their client_id must be NULL).
alter table public.program_reviews drop constraint if exists program_reviews_client_program_key;
alter table public.program_reviews add constraint program_reviews_client_program_key unique(client_id, program_id);
alter table public.program_reviews drop constraint if exists program_reviews_days_check;
alter table public.program_reviews add constraint program_reviews_days_check
  check (days_attended is null or days_attended between 0 and 31);
create index if not exists program_reviews_client_created_idx on public.program_reviews(client_id, created_at desc);
alter table public.program_reviews enable row level security;
-- Renamed policies retain their existing own-row CRUD / staff SELECT semantics.

-- Retire stale test-review notifications; preserve all other notification kinds.
delete from public.notifications where type = 'weekly_review';
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'membership_expiry', 'missing_info', 'program_review', 'manual', 'availability',
  'appointment_reminder', 'appointment_cancelled'
));

create or replace function public.guard_program_review()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare p public.programs%rowtype; zone text; today date; next_month date;
begin
  select * into p from public.programs where id = new.program_id;
  if not found or p.kind <> 'client' or p.client_id is distinct from new.client_id then
    raise exception 'review_invalid_program' using errcode = '23514';
  end if;
  select coalesce(timezone, 'Europe/Istanbul') into zone from public.profiles where id = new.client_id;
  today := (now() at time zone coalesce(zone, 'Europe/Istanbul'))::date;
  next_month := (p.month_start_date + interval '1 month')::date;
  if today < next_month - 7 or today >= next_month then
    raise exception 'review_not_due' using errcode = '23514';
  end if;
  if new.days_attended > extract(day from next_month - 1) then
    raise exception 'review_invalid_days' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists program_reviews_guard on public.program_reviews;
create trigger program_reviews_guard before insert or update on public.program_reviews
  for each row execute function public.guard_program_review();
revoke all on function public.guard_program_review() from public, anon, authenticated;

-- One RPC call = one PostgreSQL transaction. No exception handler swallows
-- child insert errors, so header changes, deletes and library inserts roll back.
-- SECURITY INVOKER keeps the staff session's RLS in force throughout.
create or replace function public.save_program(
  p_id uuid, p_kind text, p_client_id uuid, p_month_start_date date,
  p_title text, p_notes text, p_days jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare result_id uuid; day_row jsonb; ex jsonb; day_id uuid; library_id uuid;
  di integer := 0; ei integer; existing public.programs%rowtype;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'staff_access_required' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null or length(p_title) > 300 then
    raise exception 'program_invalid_title' using errcode = '22023';
  end if;
  if p_kind is null or p_kind not in ('client', 'catalog')
    or (p_kind = 'client' and (p_client_id is null or p_month_start_date is null))
    or (p_kind = 'catalog' and (p_client_id is not null or p_month_start_date is not null)) then
    raise exception 'program_invalid_shape' using errcode = '23514';
  end if;
  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) > 100 then
    raise exception 'program_invalid_days' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.programs(kind, client_id, month_start_date, title, notes)
      values(p_kind, p_client_id, p_month_start_date, btrim(p_title), nullif(btrim(p_notes), ''))
      returning id into result_id;
  else
    select * into existing from public.programs where id = p_id for update;
    if not found then raise exception 'program_not_found' using errcode = 'P0002'; end if;
    -- Assignment is a NEW snapshot, never conversion/reparenting of a source.
    if existing.kind <> p_kind or existing.client_id is distinct from p_client_id then
      raise exception 'program_ownership_immutable' using errcode = '23514';
    end if;
    if existing.month_start_date is distinct from p_month_start_date
      and exists(select 1 from public.program_reviews where program_id = p_id) then
      raise exception 'program_reviewed_month_locked' using errcode = '23514';
    end if;
    update public.programs set title = btrim(p_title), notes = nullif(btrim(p_notes), ''),
      month_start_date = p_month_start_date where id = p_id;
    result_id := p_id;
    delete from public.exercises where program_id = result_id;
    delete from public.program_days where program_id = result_id;
  end if;
  for day_row in select value from jsonb_array_elements(p_days) loop
    if jsonb_typeof(day_row->'exercises') is distinct from 'array' then
      raise exception 'program_invalid_exercises' using errcode = '22023';
    end if;
    insert into public.program_days(program_id, title, order_index)
      values(result_id, nullif(btrim(day_row->>'title'), ''), di) returning id into day_id;
    ei := 0;
    for ex in select value from jsonb_array_elements(day_row->'exercises') loop
      if nullif(btrim(ex->>'name'), '') is null then
        raise exception 'program_invalid_exercise_name' using errcode = '22023';
      end if;
      library_id := nullif(ex->>'library_id', '')::uuid;
      if library_id is null and coalesce((ex->>'saveToLibrary')::boolean, false) then
        insert into public.exercise_library(name, default_instructions)
          values(btrim(ex->>'name'), nullif(btrim(ex->>'instructions'), ''))
          on conflict(name) do nothing;
        select id into library_id from public.exercise_library where name = btrim(ex->>'name');
      end if;
      if (ex->>'sets')::integer < 0 then
        raise exception 'program_invalid_sets' using errcode = '22023';
      end if;
      insert into public.exercises(program_id, day_id, name, sets, reps, instructions, media_url, library_id, order_index)
        values(result_id, day_id, btrim(ex->>'name'), (ex->>'sets')::integer,
          nullif(btrim(ex->>'reps'), ''), nullif(btrim(ex->>'instructions'), ''),
          nullif(btrim(ex->>'media_url'), ''), library_id, ei);
      ei := ei + 1;
    end loop;
    di := di + 1;
  end loop;
  return result_id;
end $$;
revoke all on function public.save_program(uuid, text, uuid, date, text, text, jsonb) from public, anon;
grant execute on function public.save_program(uuid, text, uuid, date, text, text, jsonb) to authenticated;
commit;
