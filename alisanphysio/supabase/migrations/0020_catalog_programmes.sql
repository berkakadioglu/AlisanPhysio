-- Run manually after 0019. Do not deploy the catalogue section before this.
begin;

-- Informational lineage only. Never cascade source deletion into client copies.
alter table public.programs add column if not exists source_program_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.programs'::regclass
    and conname = 'programs_source_program_id_fkey') then
    alter table public.programs add constraint programs_source_program_id_fkey
      foreign key (source_program_id) references public.programs(id) on delete set null;
  end if;
end $$;
create index if not exists programs_source_program_id_idx
  on public.programs(source_program_id) where source_program_id is not null;

-- Old header edits had no timestamp. Use the most recent saved day, or creation,
-- as the initial baseline; do not invent lineage for older copies.
alter table public.programs add column if not exists updated_at timestamptz;
update public.programs p set updated_at = greatest(p.created_at,
  coalesce((select max(d.created_at) from public.program_days d where d.program_id = p.id), p.created_at))
  where p.updated_at is null;
alter table public.programs alter column updated_at set default now();
alter table public.programs alter column updated_at set not null;
create index if not exists programs_catalog_updated_idx
  on public.programs(updated_at desc, id) where kind = 'catalog';

create or replace function public.touch_program_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists programs_touch_updated_at on public.programs;
-- save_program always updates these header fields, including when only days change.
-- Clearing lineage on source deletion does not change a copy's content timestamp.
create trigger programs_touch_updated_at before update of title, notes, month_start_date
  on public.programs for each row execute function public.touch_program_updated_at();

-- Reuse the existing independent-snapshot save RPC, in the SAME transaction as
-- lineage recording. Its kind/ownership immutability checks remain unchanged.
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

  select coalesce(jsonb_agg(jsonb_build_object('title', d.title, 'exercises',
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
commit;
