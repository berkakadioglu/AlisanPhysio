# AlisanPhysio

A private client portal for Alişan — physiotherapist & personal trainer. Staff
(Alişan) create client accounts and author **weekly programs** (therapeutic and
fitness alike, organised Week → Day → Exercise); clients log in to view their
program for the week, browse past/upcoming weeks, watch demo videos, track body
measurements, and file a short weekly review. There is **no public sign-up** —
accounts are created by staff.

## Tech stack

- **Next.js 16** (App Router, TypeScript). Note: this version renames the
  `middleware` convention to **`proxy`** — the route guard lives at
  [`src/proxy.ts`](src/proxy.ts) (it must sit alongside `src/app`, not at the
  repo root, or it is silently ignored).
- **React 19**
- **Supabase** — auth + Postgres with **Row Level Security (RLS)**
- **Tailwind CSS v4** (design tokens + dark mode in `src/app/globals.css`)
- **lucide-react** for icons
- Deploy target: **Vercel**

## Running locally

Requires **Node 20+**.

```bash
npm install        # install dependencies
npm run dev        # start the dev server → http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

Visiting the app unauthenticated redirects to `/login` (email + password).

## Environment variables

Copy the example and fill in your own Supabase keys (never commit real values):

```bash
cp .env.local.example .env.local
```

Find these in the Supabase dashboard under **Project Settings → API**. Only the
**names** are listed here — never put actual keys/URLs in the repo:

| Variable                        | Where to find it                                     | Notes                                    |
| ------------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Settings → API → **Project URL**                     | Public                                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → Project API keys → **anon**         | Public; all access gated by RLS          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Settings → API → Project API keys → **service_role** | **Secret** — server-only, bypasses RLS   |

`SUPABASE_SERVICE_ROLE_KEY` must **not** carry the `NEXT_PUBLIC_` prefix so it
never reaches the browser. It's only used in server-side admin operations (see
`src/lib/supabase/admin.ts`).

## Database & migrations

SQL migrations live in [`supabase/migrations/`](supabase/migrations) and are
**run by hand in the Supabase SQL Editor, in order** (`0001` → `0011`). They are
written to be idempotent/re-runnable. Apply them to a fresh project top to
bottom:

| File                             | Adds                                                          |
| -------------------------------- | ------------------------------------------------------------ |
| `0001_init.sql`                  | `profiles`, `programs`, `exercises` + RLS + new-user trigger |
| `0002_exercise_library.sql`      | `exercise_library` (reusable exercises w/ demo videos)       |
| `0003_program_days.sql`          | `program_days` (Day grouping within a program)               |
| `0004_profile_language.sql`      | `profiles.language` (per-user UI language)                   |
| `0005_profile_measurements.sql`  | `measurements` + `complaints` (client-tracked data)          |
| `0006_membership.sql`            | membership tier on `profiles`                                |
| `0007_membership_end_date.sql`   | membership expiry date                                       |
| `0008_roles_manager.sql`         | `is_admin()` / `is_staff()` helpers; the `manager` role      |
| `0009_notifications_reviews.sql` | `notifications` + `weekly_reviews`                           |
| `0010_exercise_categories.sql`   | `exercise_categories` + `exercise_category_map` (m2m)        |
| `0011_day_templates.sql`         | `day_templates` + `day_template_exercises`                   |

**First admin:** create a user in Supabase **Authentication → Users** (the
trigger seeds a `client` profile), then promote:

```sql
update public.profiles set role = 'admin' where id = '<user-id>';
```

## Roles & the RLS model

`profiles.role` is one of `admin` | `manager` | `client`.

- **client** — can read/write **only their own** rows (programs, measurements,
  reviews, notifications), enforced by RLS via `auth.uid()`.
- **staff** = `is_staff()` = `admin` OR `manager` — may read/manage all users'
  content (authoring programs, the library, templates, etc.).
- **admin** = `is_admin()` — privileged actions a manager must never do (change
  roles, delete clients).

Because staff can read every row, client-facing queries **must filter by the
signed-in user explicitly** rather than relying on RLS alone. The service-role
key bypasses RLS entirely and is used **server-side only** for the few
operations that need it (creating auth users, setting passwords, reading emails
from the auth schema).

> **Note on the `manager` role:** the manager feature is postponed, so it is
> **hidden from the UI** (not offered in the role selector, no Managers tab).
> The role, `is_staff()`, and all RLS policies remain in the database intact for
> a future task — this is purely a UI hide.

Two gates run in the proxy ([`src/lib/supabase/middleware.ts`](src/lib/supabase/middleware.ts))
and are re-checked in every page/action (defense in depth):

1. **Admin area** (`/admin`) — staff only.
2. **Membership gate** — a `client` without an active membership is sent to
   `/membership-inactive` (staff are never gated).

## Feature / architecture overview

**Client side** (`src/app/dashboard`)

- This-week hero + Past / Upcoming program lists.
- Program detail: Day → Exercise with YouTube demo embeds (click-to-load).
- Profile: personal info, weekly body measurements + a dependency-free SVG
  weight/BMI chart, complaints/notes.
- Weekly review form + an inline "Add review" affordance on reviewable weeks.

**Admin side** (`src/app/admin`)

- Users list (Clients / Admins tabs), create client, per-client detail with
  Manage (name/login/role/membership), reset password, send notification.
- **Program editor** — Week → Day → Exercise authoring with a category-grouped
  library combobox, copy-from-previous-week, and **day templates** (fill a day
  from a template, or add a template as a new day; deep-copied, editable).
- **Exercise library** (`/admin/library`) — category sidebar + card grid,
  many-to-many categories, per-exercise video + default instructions.
- **Day templates** (`/admin/templates`) — reusable day blueprints.
- **Personal Exercises** — staff can view programs authored for themselves,
  reusing the client dashboard.

**Cross-cutting**

- **Membership** tiers + expiry, with a client access gate.
- **Notifications** — a bell with system-generated (measurement / feedback
  nudges) and manual (staff-authored) notices, categorised for display.
- **i18n** — Turkish / English, cookie-based, switched via the header
  `LanguageToggle`; strings + helpers in [`src/lib/i18n.ts`](src/lib/i18n.ts).
- **Dark mode** — token-driven (`globals.css`), header `ThemeToggle`, defaults
  to the OS preference, persisted in a cookie, no flash on load.

## Project layout

```
src/
  proxy.ts                   # Session refresh + route guards (Next 16 "proxy")
  app/
    login/                   # /login — email + password (no sign-up)
    dashboard/               # client area: this week, past/upcoming, program
                             #   detail, profile, weekly review, notifications
    admin/                   # staff area: users, client detail, program editor,
                             #   library, templates, actions (server actions)
    membership-inactive/     # blocked screen for inactive clients
    globals.css              # design tokens + light/dark themes
    layout.tsx  i18n-provider.tsx  theme-toggle.tsx  language-toggle.tsx
  lib/
    types.ts                 # Row types mirroring the SQL schema
    i18n.ts / i18n-server.ts # translations + helpers (EN/TR)
    theme.ts / theme-server.ts
    admin-auth.ts            # requireStaff() / requireAdmin() gates
    membership.ts  categories.ts  templates.ts  ...helpers
    supabase/
      client.ts              # browser client
      server.ts              # Server Component / Action client
      admin.ts               # service-role client (server-only)
      middleware.ts          # updateSession() used by proxy.ts
  components/                # shared UI (badges, notification bell, embeds)
supabase/
  migrations/                # 0001 → 0011, run manually in order
```

## Deploy (Vercel)

Import the repo, set the three environment variables above in the project
settings (keep `SUPABASE_SERVICE_ROLE_KEY` un-prefixed so it stays server-only),
and ensure the Supabase migrations have been applied to the target project.
