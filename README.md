# EasyRecipesCookbook

A place to record easy weeknight recipes and keep track of ingredients for a grocery list.

The current app supports email/password signup, confirmation, login, session restoration, and logout, with a private landing screen. Recipe editing and the other features in PLAN.md are planned next. There is no hosted app URL yet.

## Run locally

Use Node.js 22.12 or later and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Fill in `.env.local` with the development project's URL and **publishable** key:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

These client settings are public; database row-level security protects records. Never use a secret/service-role key in a VITE_ variable. Local env files are ignored by Git. Restart Vite after changing them. Without valid configuration the UI renders, but account submission is disabled; it does not simulate successful login.

## Configure development Supabase

1. Create or choose a development project and enable the email/password provider. Keep email confirmation enabled to exercise the complete flow. Configure a password minimum of at least 8 characters; stronger project policies are supported by server-side validation.
2. After reviewing and approving database changes, run each migration once in order using the SQL Editor (or your normal Supabase migration workflow):
   - `supabase/migrations/20261021000100_core_recipe_model.sql`
   - `supabase/migrations/20261021000200_auth_profiles.sql`
3. Under Authentication URL Configuration, set the local Site URL to `http://localhost:5173` and add both `http://localhost:5173/auth/callback` and `http://127.0.0.1:5173/auth/callback` to allowed redirects. Add the exact production HTTPS callback when a domain is available.
4. Keep the signup confirmation template using Supabase's `{{ .ConfirmationURL }}` link. The app passes its current origin plus `/auth/callback` when signing up. The browser client uses Supabase's implicit flow to process the returned session; the app then routes to `/cookbook` and removes tokens from the URL. Invalid/expired links show recovery guidance without displaying raw URL errors.
5. For external testers, configure and verify email delivery/SMTP. Default provider email restrictions and limits can prevent delivery; never claim the confirmation flow is live until a real email has been received and followed.

The second migration creates profiles through a trigger when Auth creates an account, backfills missing profiles without overwriting existing names, and removes browser permission to insert profiles manually. Accounts that are not yet email-confirmed may have a profile, but cannot access another user's data. See `schema.md` for the relationship and policies.

No migration has been applied to a hosted project as part of this implementation. Do not run test fixture SQL against a real Supabase project.

## Tests and build

```sh
pnpm test           # 5 database tests and 13 UI tests
pnpm build          # TypeScript checks and production bundle
pnpm exec playwright install chromium
pnpm test:browser   # 3 browser flows; local server started automatically
```

- Database tests use PGlite with simulated Supabase identity objects. They cover data isolation, validation, cascades, automatic profiles, and backfill behavior.
- UI tests inject an auth service to test form validation, pending submissions, session restoration/races, account switching, logout, confirmation states, and errors.
- Browser tests run the real Supabase JavaScript client with intercepted HTTP responses. They exercise desktop login/refresh/logout, mobile signup, and valid/invalid callbacks. They use test-only project settings in the test server configuration; no real accounts are created.
- These checks do **not** verify Supabase email delivery, token verification, hosted API permissions, or a deployed site. Those need the development-project checks below.

## Development-project checks before release

- Sign up with a real email address, receive confirmation, follow it, and verify the private landing screen opens.
- Confirm exactly one matching row exists in public.users and no placeholder recipes were created.
- Log out, log in again, refresh, and visit `/cookbook` directly. After logout, a refresh or direct visit must return to login.
- Repeat with a second account and confirm the first account's email/data never remain visible.
- Try an incorrect password, an unconfirmed account, an expired confirmation link, and an unavailable connection.
- Recheck ownership through the hosted API using separate user sessions; local mocks are not proof of hosted authorization.

## Structure and hosting

`src/auth` manages session state and auth operations; `src/lib/supabase.ts` configures the client; `src/App.tsx` defines screens/routes; `supabase/migrations` tracks schema changes. Supabase supplies authentication and PostgreSQL. React, TypeScript, Vite, and React Router provide the interface. See PLAN.md for the full product design.

Run `pnpm build` and serve `dist`. `vercel.json` supplies an SPA fallback for direct URLs, including `/auth/callback`. Set the public Supabase variables in the host before building and allow its callback URL in Supabase. Logout uses local scope to sign out the current browser, leaving other devices signed in.

References: [Supabase React authentication](https://supabase.com/docs/guides/auth/quickstarts/react), [password authentication](https://supabase.com/docs/guides/auth/passwords), and [user profile triggers](https://supabase.com/docs/guides/auth/managing-user-data).
