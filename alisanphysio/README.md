# Train with Alisan

A coaching platform for an independent physiotherapist and personal trainer
whose clients are mainly in Canada. It combines a public bilingual website, a
client dashboard and an admin area where the coach writes programmes, manages
nutrition and runs scheduling.

- Live: https://alisanphysio.vercel.app
- Public demo with sample data (no login): https://alisanphysio.vercel.app/demo

There is no public sign-up. Client accounts are created by the coach.

## Features

**Public site**

- English and Turkish, switchable from the header.
- Pricing page.
- Assessment request form for prospective clients.
- Free Functional Movement Screen (FMS) booking, no account needed; slots are
  shown in the visitor's time zone.
- Demo dashboard rendered from static sample data, with no database access.

**Client dashboard**

- Monthly programmes (Month, Day, Exercise) with embedded YouTube videos
  (youtube-nocookie, click to load) and formatted coaching cues.
- Past and upcoming months.
- Optional nutrition plan, switched on per client, with meals, quantities and
  calculated calories and macros.
- Progress: weight and circumference measurements (waist, hip, arm, chest)
  with a weight/BMI chart.
- Profile with personal details and a complaints log for the coach.
- Appointments: book a slot the coach published or propose times, depending
  on the coach's booking mode. Times are shown in the client's own time zone.
- Monthly review form, notifications, and a membership gate for clients whose
  membership has lapsed.

**Admin**

- Client management: create clients, membership tier and end date, language,
  password reset, notifications.
- Programme editor with drag-and-drop ordering, copy from a previous month,
  unsaved-changes guard, and optional sync of edited cues or videos back to
  the exercise library.
- Exercise library (multi-category) and food library.
- Saved days: reusable days that can be inserted into any programme and
  updated from a programme day.
- Catalogue programmes: client-independent programmes that are copied into a
  client's month.
- PDF export of programmes and saved days.
- Assessment request and FMS booking management (status, notes, FMS
  settings).
- Scheduling: booking mode, published availability (weekly repeats keep the
  same local time across DST), direct appointments, client proposals.
- View as client: a read-only preview of any client's dashboard.

## Screenshots

Not added yet. Screens to capture:

- [ ] Public home page (EN) and the same page in TR
- [ ] Pricing page
- [ ] Demo dashboard (`/demo`)
- [ ] Client dashboard: current month programme with an exercise video open
- [ ] Client progress / measurements chart
- [ ] Client nutrition view with macros
- [ ] Admin programme editor
- [ ] Admin scheduling page
- [ ] A page of an exported programme PDF
- [ ] Dark mode example

Use sample data only (the demo or throwaway accounts), not real client names
or emails.

## Tech stack and architecture

- **Next.js 16, App Router, TypeScript, React 19.** Next 16 renames
  `middleware` to `proxy`: the route guard is [`src/proxy.ts`](src/proxy.ts).
  It must sit next to `src/app`; a `proxy.ts` at the project root is silently
  ignored. It refreshes the Supabase session and enforces the admin area and
  the client membership gate; pages and actions re-check access.
- **Supabase** (Auth and Postgres). Row-level security is enabled on every
  table. Clients can read only their own rows; staff access goes through the
  `is_staff()` / `is_admin()` helpers. Roles are `admin`, `manager` and
  `client`; the `manager` role exists in the database but is not exposed in
  the UI.
- **Service-role client** ([`src/lib/supabase/admin.ts`](src/lib/supabase/admin.ts))
  is used only in server code: admin-gated actions (creating users, changing
  emails, password resets, deletes) and the public assessment and FMS booking
  actions, which validate input before inserting. The key is never sent to
  the browser.
- **Transactional saves.** Programmes and saved days are saved through
  Postgres functions (`save_program`, `save_day_template`,
  `update_day_template`) so a whole programme or day is written in one
  transaction. They run as `security invoker`, so RLS still applies.
- **Time zones.** Appointment times are stored as `timestamptz` (UTC
  instants). Profiles and coach settings store IANA zone names, validated in
  the database, and times are converted for display with `Intl`.
- **PDF export** with `@react-pdf/renderer` in Node.js route handlers under
  `src/app/admin/export`, using bundled Inter and Archivo TTF fonts
  (`src/lib/pdf/fonts`) so Turkish characters render correctly.
- **i18n.** English and Turkish catalogs in [`src/lib/i18n.ts`](src/lib/i18n.ts)
  with a `t()` helper. The language is the signed-in user's profile setting,
  falling back to a cookie. A test checks that both catalogs have the same
  keys and placeholders.
- **Styling.** Tailwind CSS v4 with design tokens in `src/app/globals.css`
  driving light and dark mode.

## Database

Migrations are numbered SQL files in [`supabase/migrations`](supabase/migrations)
(`0001` to `0022`). They are applied manually, in order, in the Supabase SQL
editor; nothing runs them automatically. Each file says which migration it
must follow.

Seeds, run manually after the migrations:

- [`supabase/seed_exercise_master_library.sql`](supabase/seed_exercise_master_library.sql):
  the coach's exercise library (105 exercises in 14 categories).
- [`supabase/seed_sports_nutrition.sql`](supabase/seed_sports_nutrition.sql):
  a food library with nutrition values (needs `0016` or later).

First admin: create a user in Supabase under Authentication, Users (a trigger
creates a `client` profile), then promote it in the SQL editor:

```sql
update public.profiles set role = 'admin' where id = '<user-id>';
```

## Running locally

Prerequisites: Node.js 22 or later (Next.js 16 needs 20.9+, and the test
command's glob pattern needs 21+), and a Supabase project with the migrations
applied.

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev
```

Open http://localhost:3000. Use `localhost`, not the machine's LAN IP:
`next.config.ts` does not set `allowedDevOrigins`, so Next.js blocks
dev-only requests from other origins.

Other commands:

```bash
npm run lint
npm run build
node --test "tests/*.test.cjs"
```

The tests use Node's built-in test runner and need no database or network.

## How it was built

Designed and specified by me, Berka Kadıoğlu. Implemented with AI coding
agents (Claude Code and Codex) working from my specifications; I reviewed and
tested every change. [`CLAUDE.md`](../CLAUDE.md) and [`AGENTS.md`](AGENTS.md)
hold the agent instructions.

Built by [Kurgu Studio](https://kurgu.studio).

## License

All rights reserved. The code is public for viewing only; no licence to use,
copy or distribute it is granted.
