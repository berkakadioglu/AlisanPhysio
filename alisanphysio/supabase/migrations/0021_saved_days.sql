-- Run manually AFTER 0020, in the Supabase SQL editor. Safe to re-run.
-- The app keeps working before this runs (it falls back to the legacy columns),
-- but soft delete / restore / replace and the origin line need it.
--
-- Saved days (formerly "Day Templates"). A saved day is a day_templates row.
-- Saving a programme day and inserting a saved day are ALWAYS copies, never
-- links: nothing here references a programme from a saved day or a saved day
-- from a programme. program_days.source_template_label is display text only.
begin;

-- -----------------------------------------------------------------------------
-- day_templates: soft delete, origin text, last-change timestamp.
-- -----------------------------------------------------------------------------
-- deleted_at: in "Recently deleted" since then; the app purges rows 30 days on.
alter table public.day_templates add column if not exists deleted_at timestamptz;
-- source_label: where it was saved from, e.g. "Test Sevim · Oct 2026"; null = created here.
alter table public.day_templates add column if not exists source_label text;
alter table public.day_templates drop constraint if exists day_templates_source_label_check;
alter table public.day_templates add constraint day_templates_source_label_check
  check (source_label is null or length(source_label) <= 300);
-- updated_at: existing rows start from their creation time.
alter table public.day_templates add column if not exists updated_at timestamptz;
update public.day_templates set updated_at = created_at where updated_at is null;
alter table public.day_templates alter column updated_at set default now();
alter table public.day_templates alter column updated_at set not null;

-- Live-name lookups (case-insensitive conflict check) and the purge sweep.
create index if not exists day_templates_live_title_idx
  on public.day_templates (lower(title)) where deleted_at is null;
create index if not exists day_templates_deleted_at_idx
  on public.day_templates (deleted_at) where deleted_at is not null;

create or replace function public.touch_day_template_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists day_templates_touch_updated_at on public.day_templates;
-- save_day_template always sets title, so content saves bump updated_at; soft
-- delete and restore only touch deleted_at and leave it alone.
create trigger day_templates_touch_updated_at before update of title, source_label
  on public.day_templates for each row execute function public.touch_day_template_updated_at();
revoke all on function public.touch_day_template_updated_at() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- program_days: where an inserted day came from (the editor's origin line).
-- Informational only — never used to link or sync content.
-- -----------------------------------------------------------------------------
alter table public.program_days add column if not exists source_template_label text;
-- Capped like the app (saveProgram trims it to 200; save_program below too).
-- Over-long values from an earlier run are shortened first so the check holds.
update public.program_days set source_template_label = left(source_template_label, 200)
  where length(source_template_label) > 200;
alter table public.program_days drop constraint if exists program_days_source_template_label_check;
alter table public.program_days add constraint program_days_source_template_label_check
  check (source_template_label is null or length(source_template_label) <= 200);

-- RLS is unchanged: the existing day_templates_staff_all and
-- day_template_exercises_staff_all policies (0011, is_staff() for all commands)
-- cover the new columns, so saved days stay staff-only. program_days keeps its
-- policies too: clients read only days of their own programmes.

-- -----------------------------------------------------------------------------
-- save_program (0018): identical signature and body, except each day now also
-- stores its source_template_label.
-- -----------------------------------------------------------------------------
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
    insert into public.program_days(program_id, title, order_index, source_template_label)
      values(result_id, nullif(btrim(day_row->>'title'), ''), di,
        left(nullif(btrim(day_row->>'source_template_label'), ''), 200))
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
-- copy_catalog_program (0020): identical, except copied days carry their
-- source_template_label so the origin line survives assignment / duplication.
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
    'source_template_label', d.source_template_label, 'exercises',
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
-- save_day_template: create (p_id null) or overwrite a LIVE saved day, its
-- exercises replaced wholesale, in ONE transaction. With p_replace_id, that
-- live saved day moves to "Recently deleted" in the same transaction, so a
-- failed save never loses the old version. No exception handler swallows
-- errors. SECURITY INVOKER keeps the staff session's RLS in force throughout.
-- p_source_label is recorded on create only: editing never rewrites the origin.
-- -----------------------------------------------------------------------------
create or replace function public.save_day_template(
  p_id uuid, p_title text, p_exercises jsonb, p_source_label text, p_replace_id uuid
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare result_id uuid; ex jsonb; library_id uuid; ei integer := 0;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'staff_access_required' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null or length(p_title) > 300 then
    raise exception 'day_template_invalid_title' using errcode = '22023';
  end if;
  -- An empty day cannot be saved.
  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array'
    or jsonb_array_length(p_exercises) = 0 or jsonb_array_length(p_exercises) > 200 then
    raise exception 'day_template_invalid_exercises' using errcode = '22023';
  end if;
  if p_replace_id is not null and p_replace_id = p_id then
    raise exception 'day_template_invalid_replace' using errcode = '22023';
  end if;

  if p_replace_id is not null then
    update public.day_templates set deleted_at = now()
      where id = p_replace_id and deleted_at is null;
    if not found then raise exception 'day_template_replace_not_found' using errcode = 'P0002'; end if;
  end if;

  if p_id is null then
    insert into public.day_templates(title, source_label)
      values(btrim(p_title), left(nullif(btrim(p_source_label), ''), 300))
      returning id into result_id;
  else
    -- Always sets title, so the touch trigger records the content change.
    update public.day_templates set title = btrim(p_title)
      where id = p_id and deleted_at is null
      returning id into result_id;
    if result_id is null then raise exception 'day_template_not_found' using errcode = 'P0002'; end if;
    delete from public.day_template_exercises where template_id = result_id;
  end if;

  for ex in select value from jsonb_array_elements(p_exercises) loop
    if jsonb_typeof(ex) is distinct from 'object' or nullif(btrim(ex->>'name'), '') is null then
      raise exception 'day_template_invalid_exercise_name' using errcode = '22023';
    end if;
    library_id := nullif(ex->>'library_id', '')::uuid;
    if library_id is null and coalesce((ex->>'saveToLibrary')::boolean, false) then
      insert into public.exercise_library(name, default_instructions)
        values(btrim(ex->>'name'), nullif(btrim(ex->>'instructions'), ''))
        on conflict(name) do nothing;
      select id into library_id from public.exercise_library where name = btrim(ex->>'name');
    end if;
    if (ex->>'sets')::integer < 0 then
      raise exception 'day_template_invalid_sets' using errcode = '22023';
    end if;
    insert into public.day_template_exercises(template_id, name, sets, reps, instructions, media_url, library_id, order_index)
      values(result_id, btrim(ex->>'name'), (ex->>'sets')::integer,
        nullif(btrim(ex->>'reps'), ''), nullif(btrim(ex->>'instructions'), ''),
        nullif(btrim(ex->>'media_url'), ''), library_id, ei);
    ei := ei + 1;
  end loop;
  return result_id;
end $$;
revoke all on function public.save_day_template(uuid, text, jsonb, text, uuid) from public, anon;
grant execute on function public.save_day_template(uuid, text, jsonb, text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- revert_day_template_save: the Undo of "Save day as template". Removes the
-- saved day that was just created (its exercises cascade) and, when it replaced
-- one, brings that one back from "Recently deleted" — both or neither.
-- -----------------------------------------------------------------------------
create or replace function public.revert_day_template_save(p_created_id uuid, p_restore_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'staff_access_required' using errcode = '42501';
  end if;
  if p_created_id is null or p_created_id = p_restore_id then
    raise exception 'day_template_invalid_revert' using errcode = '22023';
  end if;
  delete from public.day_templates where id = p_created_id;
  if not found then raise exception 'day_template_not_found' using errcode = 'P0002'; end if;
  if p_restore_id is not null then
    update public.day_templates set deleted_at = null
      where id = p_restore_id and deleted_at is not null;
    if not found then raise exception 'day_template_restore_not_found' using errcode = 'P0002'; end if;
  end if;
end $$;
revoke all on function public.revert_day_template_save(uuid, uuid) from public, anon;
grant execute on function public.revert_day_template_save(uuid, uuid) to authenticated;

commit;

-- -----------------------------------------------------------------------------
-- Verification (run after the migration; every column should be true):
--
-- select
--   exists(select 1 from information_schema.columns where table_schema = 'public'
--     and table_name = 'day_templates' and column_name = 'deleted_at'
--     and data_type = 'timestamp with time zone' and is_nullable = 'YES') as day_templates_deleted_at,
--   exists(select 1 from information_schema.columns where table_schema = 'public'
--     and table_name = 'day_templates' and column_name = 'source_label'
--     and data_type = 'text' and is_nullable = 'YES') as day_templates_source_label,
--   exists(select 1 from information_schema.columns where table_schema = 'public'
--     and table_name = 'day_templates' and column_name = 'updated_at'
--     and data_type = 'timestamp with time zone' and is_nullable = 'NO'
--     and column_default = 'now()') as day_templates_updated_at,
--   exists(select 1 from information_schema.columns where table_schema = 'public'
--     and table_name = 'program_days' and column_name = 'source_template_label'
--     and data_type = 'text' and is_nullable = 'YES') as program_days_source_template_label,
--   exists(select 1 from pg_constraint where conrelid = 'public.program_days'::regclass
--     and conname = 'program_days_source_template_label_check') as program_days_label_length_check,
--   exists(select 1 from pg_trigger where tgrelid = 'public.day_templates'::regclass
--     and tgname = 'day_templates_touch_updated_at' and not tgisinternal) as touch_trigger,
--   to_regprocedure('public.touch_day_template_updated_at()') is not null as touch_function,
--   to_regprocedure('public.save_day_template(uuid, text, jsonb, text, uuid)') is not null as save_day_template_function,
--   to_regprocedure('public.revert_day_template_save(uuid, uuid)') is not null as revert_function,
--   position('source_template_label' in pg_get_functiondef(
--     'public.save_program(uuid, text, uuid, date, text, text, jsonb)'::regprocedure)) > 0 as save_program_stores_label;
-- -----------------------------------------------------------------------------
