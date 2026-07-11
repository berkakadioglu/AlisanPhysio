-- =============================================================================
-- AlisanPhysio — exercise library
-- Run AFTER 0001_init.sql, in the Supabase SQL editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- exercise_library: reusable exercises Alişan picks from (with demo videos).
-- -----------------------------------------------------------------------------
create table if not exists public.exercise_library (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  youtube_url          text,          -- full YouTube link (nullable until filmed)
  default_instructions text,          -- coaching cue pre-filled when picked
  created_at           timestamptz not null default now(),
  constraint exercise_library_name_key unique (name)
);

-- Link a per-program exercise back to a library entry (for its video/name).
-- One-off exercises leave this null.
alter table public.exercises
  add column if not exists library_id uuid
    references public.exercise_library (id) on delete set null;

create index if not exists exercises_library_id_idx
  on public.exercises (library_id);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.exercise_library enable row level security;

-- The library is shared reference data: any signed-in user may read it, so the
-- client program page can resolve an exercise's video and name.
create policy "exercise_library_select_authenticated"
  on public.exercise_library
  for select
  using (auth.uid() is not null);

-- Admins have full CRUD (consistent with the other *_admin_all policies).
create policy "exercise_library_admin_all"
  on public.exercise_library
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Seed ~12 common exercises (videos added later; sensible cues for now).
-- Idempotent: safe to re-run.
-- -----------------------------------------------------------------------------
insert into public.exercise_library (name, default_instructions) values
  ('Goblet Squat',            'Hold a dumbbell at your chest; sit back and down, chest tall, knees tracking over your toes.'),
  ('Romanian Deadlift',       'Soft knees, hinge from the hips, keep the weight close, feel the hamstrings lengthen.'),
  ('Plank',                   'Forearms down, body in one straight line, brace your core — don''t let the hips sag.'),
  ('Glute Bridge',            'Feet flat, drive through your heels, squeeze the glutes at the top for a second.'),
  ('Cat-Cow Mobility',        'Move slowly with your breath — arch on the inhale, round on the exhale.'),
  ('Bird Dog',                'Extend the opposite arm and leg, keep your hips level, move slow and controlled.'),
  ('Bulgarian Split Squat',   'Rear foot elevated, drop straight down, front knee tracking over the foot.'),
  ('Dead Bug',                'Lower back gently pressed to the floor, extend the opposite arm and leg slowly.'),
  ('Wall Sit',                'Back flat against the wall, thighs parallel to the floor, hold and breathe.'),
  ('Band Pull-Apart',         'Arms straight out, pull the band apart to your chest, squeeze the shoulder blades.'),
  ('Single-Leg Glute Bridge', 'One foot planted, drive through the heel, keep your hips level throughout.'),
  ('Side Plank',              'Stack your hips and shoulders, lift the hips, hold a straight line.')
on conflict (name) do nothing;
