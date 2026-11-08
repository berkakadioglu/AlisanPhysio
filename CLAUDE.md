# AlisanPhysio (Train with Alisan)

A coaching platform for a physiotherapist / personal trainer (Alişan): a public
bilingual marketing site, a client dashboard (monthly programmes, nutrition,
progress, appointments) and a staff area where the coach authors programmes,
nutrition plans and reusable content. The app lives in the `alisanphysio/`
subdirectory — run all commands from there.

> Note: `alisanphysio/AGENTS.md` warns that this is **Next.js 16** with breaking
> changes vs. older versions — read `node_modules/next/dist/docs/` before writing
> framework code and heed deprecation notices.

## Stack & layout

- **Next.js 16** (App Router, TypeScript, React 19) + **Supabase** (auth +
  Postgres with RLS) + **Tailwind v4**. Deployed on Vercel at
  https://alisanphysio.vercel.app (Vercel root directory = `alisanphysio/`).
- Key dirs (under `alisanphysio/src`):
  - `app/(marketing)` — public site: home, pricing, assessment request form,
    free FMS booking, and `/demo` (static sample data from `lib/demo-data.ts`,
    no database access).
  - `app/dashboard` — client-facing (this-month programme, past/upcoming,
    programme detail, nutrition, progress, appointments, profile, monthly
    review).
  - `app/admin` — staff area: clients list + client detail (incl. nutrition
    editor and read-only **view-as-client** at `clients/[id]/view/*`),
    programmes (catalogue programmes + **Saved days**, under `programs/`),
    exercise library, food library, assessment requests (`requests/`), FMS
    bookings (`fms/`), scheduling (`availability/`), and PDF export route
    handlers (`export/`). `admin/templates/*` only redirects: Day Templates
    became the Saved days tab of Programmes.
  - `lib` — Supabase clients (incl. a **server-only service-role** admin client
    in `supabase/admin.ts`), `i18n.ts` (a `t()` helper + `en`/`tr` catalogs),
    `i18n-server.ts` (`getLang()`), `admin-auth.ts` (`requireStaff` /
    `requireAdmin`), `rich-text.ts` (Markdown-subset coaching text),
    `scheduling.ts` (IANA time-zone maths), `pdf/` (react-pdf export),
    `saved-days.ts`, `templates.ts`, `catalog-programs.ts`, `nutrition*.ts`,
    `types.ts`.
  - `proxy.ts` — the route guard / middleware. **Lives at `src/proxy.ts`** (not
    the repo root) — Next 16 silently ignores it elsewhere. It is the
    membership-gate enforcement point.
  - `app/globals.css` — design tokens (CSS variables) that are the single source
    of truth for all colors and drive both light and dark modes.
- `supabase/migrations` holds `0001`–`0022`; `supabase/seed_*.sql` are manual
  seed files. **Migrations are hand-run in order** by the maintainer in the
  Supabase SQL editor. Write new ones as numbered files and say exactly what to
  run — do not attempt to apply them yourself.
- Tests: `node --test "tests/*.test.cjs"` (Node's built-in runner; `tests/load-ts.cjs`
  transpiles TS on the fly). No database or network needed.
- Environment variables are listed in `alisanphysio/.env.example`.

## What already exists and works (extend, don't rebuild)

- **Auth + roles** in `profiles.role`: `admin` | `manager` | `client`. DB helpers
  `is_admin()` and `is_staff()` (= admin OR manager). The **`manager` role exists
  in the DB + RLS but is HIDDEN from the UI** (feature postponed) — don't
  re-surface it.
- **RLS everywhere**, isolating client data: a client reads only their own rows;
  staff get broad access via `is_staff()`. This is the security core.
- **Public site:** EN/TR marketing pages, pricing, assessment request form, free
  FMS booking (no account, visitor's time zone), and the `/demo` dashboard.
- **Client side:** dashboard (this-month programme + past/upcoming), programme
  detail with embedded youtube-nocookie players and rich-text cues, progress
  (weight/BMI chart + circumference measurements), profile (personal info,
  complaints log), optional nutrition (per-client toggle, calories/macros),
  appointments (book published slots or propose times, shown in the client's
  time zone), a monthly-review flow, a notification bell, and a client-only
  membership access gate.
- **Staff side:** create/manage/delete clients (name, email, height, language,
  membership tier + end-date, password reset), author programmes for ANY user
  (`programs.client_id` can be any profile — staff have "Personal Exercises" for
  themselves), a programme editor (Month → Day → Exercise, category-grouped
  exercise search, drag-and-drop ordering, copy-from-previous-month, month
  select, unsaved-changes guard, library sync), saved days (insert into a
  programme, update from a programme day), catalogue programmes (copied into a
  client's month), an exercise library with multi-category support, a food
  library, a per-client nutrition plan editor, PDF export, assessment-request
  and FMS-booking management, scheduling (booking mode, published availability,
  direct appointments, client proposals), and view-as-client.
- **Membership tiers** (platinum/gold/silver/bronze + end date), **notifications**,
  full **TR/EN i18n** (default EN, header toggle, `profiles.language`), and full
  **dark mode** (token-driven, system-preference default + header toggle).
- **Theme:** deep forest green (`#14532D`) accent, Archivo (headings) + Inter
  (body), light canvas with green-tinted card surfaces — all via CSS variables in
  `globals.css` so light + dark both work.

## Rules to follow throughout

- **Never weaken RLS.** A client must only ever read their own data. When adding
  tables, mirror the existing RLS patterns and verify cross-user isolation with a
  real client token. Because staff can read every row, client-facing
  self-queries must filter by the signed-in user explicitly, not rely on RLS.
- **Keep the service-role key server-only.** It is used only in server code:
  admin-gated actions (creating auth users, changing client emails, password
  resets, deletes) and the public assessment / FMS booking actions, which
  validate input before inserting. Never expose it to the browser.
- **All new user-facing strings go through i18n** with BOTH English and natural
  (physio/fitness-appropriate) Turkish — add every key to `en` AND `tr`.
- **Keep the forest-green theme and full dark-mode correctness** on every new
  screen (use the CSS-variable tokens, not hardcoded colors).
- **Migrations are hand-run in order** — write new numbered files and tell the
  maintainer what to run; never apply them yourself.
- Verify end-to-end with throwaway users + screenshots, then delete the throwaway
  users.
