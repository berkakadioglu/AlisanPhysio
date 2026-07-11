-- =============================================================================
-- AlisanPhysio — optional day layer (Week → Day → Exercise)
-- Run AFTER 0002, in the Supabase SQL editor. Safe/idempotent to re-run.
-- Existing flat programs are preserved: their exercises are grouped under one
-- untitled default day, which the app renders exactly like a flat list.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- program_days: an optional named grouping of exercises within a program.
-- -----------------------------------------------------------------------------
create table if not exists public.program_days (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs (id) on delete cascade,
  title       text,          -- nullable: a day can be untitled (e.g. "Chest Day")
  order_index integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists program_days_program_id_idx
  on public.program_days (program_id);

-- Link each exercise to an (optional) day.
alter table public.exercises
  add column if not exists day_id uuid
    references public.program_days (id) on delete set null;

create index if not exists exercises_day_id_idx
  on public.exercises (day_id);

-- -----------------------------------------------------------------------------
-- Row Level Security (mirrors the existing exercises pattern)
-- -----------------------------------------------------------------------------
alter table public.program_days enable row level security;

-- A client can read only days belonging to one of their own programs.
create policy "program_days_select_own"
  on public.program_days
  for select
  using (
    exists (
      select 1
      from public.programs p
      where p.id = program_days.program_id
        and p.client_id = auth.uid()
    )
  );

-- Admins can do everything with days.
create policy "program_days_admin_all"
  on public.program_days
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Data migration (critical): group existing exercises under one default day
-- per program. Idempotent — only touches exercises that don't yet have a day.
-- -----------------------------------------------------------------------------
do $$
declare
  prog record;
  new_day_id uuid;
begin
  for prog in
    select distinct e.program_id
    from public.exercises e
    where e.day_id is null
  loop
    insert into public.program_days (program_id, title, order_index)
    values (prog.program_id, null, 0)
    returning id into new_day_id;

    update public.exercises
    set day_id = new_day_id
    where program_id = prog.program_id
      and day_id is null;
  end loop;
end $$;
