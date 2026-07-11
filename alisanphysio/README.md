# AlisanPhysio

A private client portal for Alişan — physiotherapist & personal trainer. Alişan
(admin) creates client accounts and writes weekly **programs** (therapeutic and
fitness alike); clients log in to view them. There is **no public sign-up**.

## Stack

- **Next.js 16** (App Router, TypeScript) — note: `create-next-app@latest`
  installed v16, which renames the `middleware` convention to `proxy` (see
  [`proxy.ts`](proxy.ts)).
- **Supabase** — auth + Postgres (with Row Level Security)
- **Tailwind CSS v4**
- Deploy target: **Vercel**

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy the example file and fill in your Supabase keys:

   ```bash
   cp .env.local.example .env.local
   ```

   Find these in the Supabase dashboard under **Project Settings → API**:

   | Variable                        | Where to find it                                  | Notes                                  |
   | ------------------------------- | ------------------------------------------------- | -------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`      | Settings → API → **Project URL**                  | Public                                 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → Project API keys → **anon**      | Public; access gated by RLS            |
   | `SUPABASE_SERVICE_ROLE_KEY`     | Settings → API → Project API keys → **service_role** | **Secret** — server-only, bypasses RLS |

3. **Apply the database schema**

   Open the Supabase **SQL Editor** and run the migration in
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). It
   creates the `profiles`, `programs`, and `exercises` tables, enables Row Level
   Security with client/admin policies, and adds a trigger that auto-creates a
   profile for every new auth user.

4. **Create the admin (Alişan)**

   - In Supabase **Authentication → Users**, add a user with his email/password.
   - The trigger creates his profile as a `client`. Promote him:

     ```sql
     update public.profiles set role = 'admin' where id = '<his-user-id>';
     ```

5. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to
   `/login`.

## Project layout

```
proxy.ts                     # Session refresh + route protection (Next 16 "proxy")
src/
  app/
    login/                   # /login — email + password (no sign-up)
    dashboard/               # /dashboard — protected client view
    layout.tsx  page.tsx
  lib/
    constants.ts             # BRAND_NAME lives here — rebrand in one place
    types.ts                 # Row types mirroring the SQL schema
    supabase/
      client.ts              # Browser client
      server.ts              # Server Component / Action client
      admin.ts               # Service-role client (admin ops only)
      middleware.ts          # updateSession() used by proxy.ts
supabase/
  migrations/0001_init.sql   # Schema + RLS policies
```

## Deploy on Vercel

Import the repo into Vercel and add the three environment variables from
`.env.local.example` in the project settings. `SUPABASE_SERVICE_ROLE_KEY` must
**not** use the `NEXT_PUBLIC_` prefix so it stays server-only.
