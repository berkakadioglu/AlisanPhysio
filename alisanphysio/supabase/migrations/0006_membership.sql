-- =============================================================================
-- AlisanPhysio — membership tiers (Platinum / Gold / Silver / Bronze).
-- Run AFTER 0005, in the Supabase SQL editor. Safe/idempotent (re-runnable).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles.membership — the client's membership tier, set by the ADMIN only.
-- null = no membership assigned.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists membership text
    check (membership is null or membership in ('platinum', 'gold', 'silver', 'bronze'));

-- -----------------------------------------------------------------------------
-- Prevent a client from changing privileged columns on their OWN row.
--
-- 0005 lets a client update their own profile (name, height, language) and pins
-- role = 'client' via the policy WITH CHECK. But membership must ALSO be
-- admin-only, and a policy WITH CHECK can only see the NEW row — it can't tell
-- whether `membership` (or `role`) actually changed. A BEFORE UPDATE trigger is
-- the correct tool: it sees BOTH old and new and can reject the change.
--
-- Trusted contexts pass straight through:
--   • service-role connections have no JWT subject → auth.uid() is null;
--     they already bypass RLS by design, so we let them through.
--   • admins (is_admin()) may change anything.
-- Everyone else (a regular authenticated client) may not alter role/membership.
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
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row
  execute function public.profiles_guard_privileged_columns();
