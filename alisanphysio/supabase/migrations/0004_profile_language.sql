-- =============================================================================
-- AlisanPhysio — per-user UI language (TR / EN)
-- Run AFTER 0003, in the Supabase SQL editor. Safe/idempotent.
-- Existing users default to English.
-- =============================================================================

alter table public.profiles
  add column if not exists language text not null default 'en'
    check (language in ('en', 'tr'));
