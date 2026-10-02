# AlisanPhysio

A physiotherapy / personal-training client portal: a client-facing program &
nutrition portal plus a staff area where the practitioner (Alişan) authors
programs, nutrition plans, and reusable content. The app lives in the
`alisanphysio/` subdirectory — run all commands from there.

> Note: `alisanphysio/AGENTS.md` warns that this is **Next.js 16** with breaking
> changes vs. older versions — read `node_modules/next/dist/docs/` before writing
> framework code and heed deprecation notices.

## Stack & layout

- **Next.js 16** (App Router, TypeScript) + **Supabase** (auth + Postgres with
  RLS) + **Tailwind**. Deploy target Vercel (not deployed yet).
- Key dirs (under `alisanphysio/src`):
  - `app/dashboard` — client-facing (this-month program hero, past/upcoming,
    program detail, profile, monthly review, nutrition).
  - `app/admin` — staff area (header/nav, clients list, client detail, exercise
    library, day templates, food library, nutrition editor).
  - `lib` — Supabase clients (incl. a **server-only service-role** admin client),
    `i18n.ts` (a `t()` helper + `en`/`tr` catalogs), `i18n-server.ts` (`getLang()`
    from cookie), `admin-auth.ts` (`requireStaff` / `requireAdmin`),
    `categories.ts`, `templates.ts`, `nutrition.ts`, `types.ts`.
  - `proxy.ts` — the route guard / middleware. **Lives at `src/proxy.ts`** (not
    the repo root) — Next 16 silently ignores it elsewhere. It is the
    membership-gate enforcement point.
  - `app/globals.css` — design tokens (CSS variables) that are the single source
    of truth for all colors and drive both light and dark modes.
- `supabase/migrations` holds `0001`–`0012`. **Migrations are hand-run in order**
  by the maintainer in the Supabase SQL editor. Write new ones as numbered files
  and say exactly what to run — do not attempt to apply them yourself.

## What already exists and works (extend, don't rebuild)

- **Auth + roles** in `profiles.role`: `admin` | `manager` | `client`. DB helpers
  `is_admin()` and `is_staff()` (= admin OR manager). The **`manager` role exists
  in the DB + RLS but is HIDDEN from the UI** (feature postponed) — don't
  re-surface it.
- **RLS everywhere**, isolating client data: a client reads only their own rows;
  staff get broad access via `is_staff()`. This is the security core.
- **Client side:** dashboard (this-month hero + past/upcoming), program detail with
  embedded youtube-nocookie players, a profile module (personal info, weight/BMI
  chart + circumference measurements, complaints log), a monthly-review flow, a
  notification bell, a small nutrition card + full nutrition view, and a
  client-only membership access gate.
- **Staff side:** create/manage/delete clients (name, email, height, language,
  membership tier + end-date, password reset), author programs for ANY user
  (`programs.client_id` can be any profile — staff have "Personal Exercises" for
  themselves), an exercise library with multi-category support, reusable day
  templates, a food library, a per-client nutrition plan editor, and a program
  editor (Month → Day → Exercise, category-grouped searchable combobox,
  copy-from-previous-month, month dropdown).
- **Membership tiers** (platinum/gold/silver/bronze + end date), **notifications**,
  full **TR/EN i18n** (default EN, header toggle, `profiles.language`), and full
  **dark mode** (token-driven, system-preference default + header toggle).
- **Theme:** deep forest green (`#14532D`) accent, Archivo (headings) + Inter
  (body), light canvas with green-tinted card surfaces — all via CSS variables in
  `globals.css` so light + dark both work.

## Rules to follow throughout

- **Never weaken RLS.** A client must only ever read their own data. When adding
  tables, mirror the existing RLS patterns and verify cross-user isolation with a
  real client token.
- **Keep the service-role key server-only** (used only in admin-gated server
  actions: creating auth users, changing client emails, password resets, deletes).
  Never expose it to the browser.
- **All new user-facing strings go through i18n** with BOTH English and natural
  (physio/fitness-appropriate) Turkish — add every key to `en` AND `tr`.
- **Keep the forest-green theme and full dark-mode correctness** on every new
  screen (use the CSS-variable tokens, not hardcoded colors).
- **Migrations are hand-run in order** — write new numbered files and tell the
  maintainer what to run; never apply them yourself.
- Verify end-to-end with throwaway users + screenshots, then delete the throwaway
  users.
