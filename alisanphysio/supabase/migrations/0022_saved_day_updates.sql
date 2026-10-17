-- Run manually AFTER 0021, in the Supabase SQL editor. Safe to re-run.
-- The app keeps working before this runs: days just don't remember their saved
-- day, so "Update saved day" never shows (and says it needs the migration if it
-- is reached from a day inserted in the same session).
--
-- "Update saved day". A programme day remembers which saved day it was inserted
-- from, or saved as, in program_days.source_template_id. That id is used ONLY
-- to find the saved day an update targets: it never links content. Inserting a
-- saved day still copies it, programmes that used a saved day never change when
-- it is updated, and deleting (purging) a saved day just clears the reference.
begin;

-- -----------------------------------------------------------------------------
-- program_days.source_template_id
-- -----------------------------------------------------------------------------
alter table public.program_days add column if not exists source_template_id uuid;
alter table public.program_days drop constraint if exists program_days_source_template_id_fkey;
alter table public.program_days add constraint program_days_source_template_id_fkey
  foreign key (source_template_id) references public.day_templates(id) on delete set null;
-- The FK's ON DELETE SET NULL scans program_days when a saved day is purged.
create index if not exists program_days_source_template_id_idx
  on public.program_days (source_template_id) where source_template_id is not null;

-- RLS is unchanged: program_days_staff_all (0008) covers the new column for
-- staff; clients still read only the days of their own programmes (the id of a
-- saved day tells them nothing — day_templates stays staff-only).

-- -----------------------------------------------------------------------------
-- save_program (0021): identical signature and body, except each day also
-- stores source_template_id. An id that is not a uuid, or names a saved day
-- that no longer exists (purged), is stored as null instead of failing the
-- save; FOR KEY SHARE keeps the saved day from being purged before commit.
-- -----------------------------------------------------------------------------
create or replace function public.save_program(
  p_id uuid, p_kind text, p_client_id uuid, p_month_start_date date,
  p_title text, p_notes text, p_days jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare result_id uuid; day_row jsonb; ex jsonb; day_id uuid; library_id uuid;
  template_id uuid; di integer := 0; ei integer; existing public.programs%rowtype;
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
    -- CASE, not AND: the cast must never run on a value that isn't a uuid.
    template_id := case
      when coalesce(day_row->>'source_template_id', '')
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (day_row->>'source_template_id')::uuid end;
    if template_id is not null then
      select t.id into template_id from public.day_templates t
        where t.id = template_id for key share;
    end if;
    insert into public.program_days(program_id, title, order_index, source_template_label, source_template_id)
      values(result_id, nullif(btrim(day_row->>'title'), ''), di,
        left(nullif(btrim(day_row->>'source_template_label'), ''), 200), template_id)
      returning id into day_id;
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

-- -----------------------------------------------------------------------------
-- copy_catalog_program (0021): identical, except copied days also carry
-- source_template_id (save_program re-checks it).
-- -----------------------------------------------------------------------------
create or replace function public.copy_catalog_program(
  p_source_id uuid, p_client_id uuid, p_month_start_date date,
  p_title text, p_ungrouped_title text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare source public.programs%rowtype; result_id uuid; days jsonb; ungrouped jsonb;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'staff_access_required' using errcode = '42501';
  end if;
  select * into source from public.programs where id = p_source_id and kind = 'catalog' for share;
  if not found then raise exception 'catalog_not_found' using errcode = 'P0002'; end if;
  if p_client_id is not null then
    if p_month_start_date is null or extract(day from p_month_start_date) <> 1 then
      raise exception 'program_invalid_month' using errcode = '22023';
    end if;
    if not exists(select 1 from public.profiles where id = p_client_id and role = 'client') then
      raise exception 'catalog_invalid_client' using errcode = '22023';
    end if;
    -- No inserts before this check. The existing unique index also closes races.
    if exists(select 1 from public.programs where kind = 'client'
      and client_id = p_client_id and month_start_date = p_month_start_date) then
      raise exception 'program_month_taken' using errcode = '23505';
    end if;
  elsif p_month_start_date is not null then
    raise exception 'program_invalid_shape' using errcode = '23514';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('title', d.title,
    'source_template_label', d.source_template_label,
    'source_template_id', d.source_template_id, 'exercises',
    (select coalesce(jsonb_agg(jsonb_build_object(
      'name', e.name, 'sets', e.sets, 'reps', e.reps, 'instructions', e.instructions,
      'media_url', e.media_url, 'library_id', e.library_id
    ) order by e.order_index, e.id), '[]'::jsonb)
      from public.exercises e where e.program_id = source.id and e.day_id = d.id)
  ) order by d.order_index, d.id), '[]'::jsonb) into days
    from public.program_days d where d.program_id = source.id;

  -- Preserve legacy exercises that have no valid day, just like loadEditorDays.
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', e.name, 'sets', e.sets, 'reps', e.reps, 'instructions', e.instructions,
    'media_url', e.media_url, 'library_id', e.library_id
  ) order by e.order_index, e.id), '[]'::jsonb) into ungrouped
    from public.exercises e where e.program_id = source.id
      and not exists(select 1 from public.program_days d where d.id = e.day_id and d.program_id = source.id);
  if jsonb_array_length(ungrouped) > 0 then
    days := days || jsonb_build_array(jsonb_build_object(
      'title', coalesce(nullif(btrim(p_ungrouped_title), ''), 'Other exercises'), 'exercises', ungrouped));
  end if;

  result_id := public.save_program(null,
    case when p_client_id is null then 'catalog' else 'client' end,
    p_client_id, p_month_start_date, coalesce(p_title, source.title), source.notes, days);
  if p_client_id is not null then
    update public.programs set source_program_id = source.id where id = result_id;
  end if;
  return result_id;
end $$;
revoke all on function public.copy_catalog_program(uuid, uuid, date, text, text) from public, anon;
grant execute on function public.copy_catalog_program(uuid, uuid, date, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- update_day_template: "Update saved day". The saved day keeps its id, name
-- and origin; its exercises are replaced (through save_day_template, so the
-- same validation applies). The version it had before is kept as a separate
-- row in "Recently deleted" (restorable for 30 days, like the Replace path).
-- One transaction: a failed update changes nothing. Returns that row's id.
-- -----------------------------------------------------------------------------
create or replace function public.update_day_template(p_id uuid, p_exercises jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare live public.day_templates%rowtype; archive_id uuid;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'staff_access_required' using errcode = '42501';
  end if;
  select * into live from public.day_templates
    where id = p_id and deleted_at is null for update;
  if not found then raise exception 'day_template_not_found' using errcode = 'P0002'; end if;

  insert into public.day_templates(title, source_label, created_at, updated_at, deleted_at)
    values(live.title, live.source_label, live.created_at, live.updated_at, now())
    returning id into archive_id;
  insert into public.day_template_exercises(template_id, name, sets, reps, instructions, media_url, library_id, order_index)
    select archive_id, e.name, e.sets, e.reps, e.instructions, e.media_url, e.library_id, e.order_index
      from public.day_template_exercises e where e.template_id = live.id;

  perform public.save_day_template(live.id, live.title, p_exercises, null, null);
  return archive_id;
end $$;
revoke all on function public.update_day_template(uuid, jsonb) from public, anon;
grant execute on function public.update_day_template(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- revert_day_template_update: the Undo of "Update saved day". Puts the kept
-- version's exercises (and last-change time) back on the live saved day and
-- removes that kept row from "Recently deleted" — both or neither.
-- -----------------------------------------------------------------------------
create or replace function public.revert_day_template_update(p_id uuid, p_archive_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare archived public.day_templates%rowtype;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'staff_access_required' using errcode = '42501';
  end if;
  if p_id is null or p_archive_id is null or p_id = p_archive_id then
    raise exception 'day_template_invalid_revert' using errcode = '22023';
  end if;
  perform 1 from public.day_templates where id = p_id and deleted_at is null for update;
  if not found then raise exception 'day_template_not_found' using errcode = 'P0002'; end if;
  select * into archived from public.day_templates
    where id = p_archive_id and deleted_at is not null for update;
  if not found then raise exception 'day_template_restore_not_found' using errcode = 'P0002'; end if;

  delete from public.day_template_exercises where template_id = p_id;
  insert into public.day_template_exercises(template_id, name, sets, reps, instructions, media_url, library_id, order_index)
    select p_id, e.name, e.sets, e.reps, e.instructions, e.media_url, e.library_id, e.order_index
      from public.day_template_exercises e where e.template_id = archived.id;
  -- updated_at is not a trigger column, so this keeps the restored time.
  update public.day_templates set updated_at = archived.updated_at where id = p_id;
  delete from public.day_templates where id = archived.id;
end $$;
revoke all on function public.revert_day_template_update(uuid, uuid) from public, anon;
grant execute on function public.revert_day_template_update(uuid, uuid) to authenticated;

commit;

-- -----------------------------------------------------------------------------
-- Verification (run after the migration; every column should be true):
--
-- select
--   exists(select 1 from information_schema.columns where table_schema = 'public'
--     and table_name = 'program_days' and column_name = 'source_template_id'
--     and data_type = 'uuid' and is_nullable = 'YES') as program_days_source_template_id,
--   exists(select 1 from pg_constraint c
--     where c.conrelid = 'public.program_days'::regclass
--       and c.conname = 'program_days_source_template_id_fkey' and c.contype = 'f'
--       and c.confrelid = 'public.day_templates'::regclass
--       and c.confdeltype = 'n') as fk_to_day_templates_on_delete_set_null,
--   to_regclass('public.program_days_source_template_id_idx') is not null as fk_index,
--   position('source_template_id' in pg_get_functiondef(
--     'public.save_program(uuid, text, uuid, date, text, text, jsonb)'::regprocedure)) > 0 as save_program_stores_id,
--   position('source_template_id' in pg_get_functiondef(
--     'public.copy_catalog_program(uuid, uuid, date, text, text)'::regprocedure)) > 0 as copy_catalog_carries_id,
--   to_regprocedure('public.update_day_template(uuid, jsonb)') is not null as update_function,
--   to_regprocedure('public.revert_day_template_update(uuid, uuid)') is not null as revert_update_function;
-- -----------------------------------------------------------------------------
