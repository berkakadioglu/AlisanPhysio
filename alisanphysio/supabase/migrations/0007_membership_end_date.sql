-- =============================================================================
-- AlisanPhysio — membership expiry date.
-- Run AFTER 0006, in the Supabase SQL editor. Safe/idempotent (re-runnable).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles.membership_end_date — the day the client's membership lapses.
-- null = no expiry set (open-ended). Set by the ADMIN only.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists membership_end_date date;

-- -----------------------------------------------------------------------------
-- Extend the privileged-columns guard so a client also cannot change their own
-- membership_end_date (admin-only, like membership + role). Clients editing
-- their own name / height / language stays allowed. Service-role and admins
-- pass straight through (unchanged from 0006).
-- -----------------------------------------------------------------------------
create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;  -- service-role or admin: unrestricted
  end if;
  if new.role is distinct from old.role then
    raise exception 'Clients cannot change their role.' using errcode = '42501';
  end if;
  if new.membership is distinct from old.membership then
    raise exception 'Clients cannot change their membership.' using errcode = '42501';
  end if;
  if new.membership_end_date is distinct from old.membership_end_date then
    raise exception 'Clients cannot change their membership end date.' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- The trigger itself is unchanged (it already calls this function), but we
-- re-assert it idempotently in case 0006 wasn't applied in this database.
drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row
  execute function public.profiles_guard_privileged_columns();
