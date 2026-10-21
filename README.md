# EasyRecipesCookbook
A place to record easy weeknight recipes and keep track of ingredients for a grocery list

## Current work

The app plan is in `PLAN.md`. The first database migration defines private user profiles, recipes, and ingredients. See `schema.md` for fields, relationships, and feature boundaries. The web interface and hosting are not set up yet.

## Run database tests

Install Node.js 22 or later and pnpm 11, then run:

```sh
pnpm install --frozen-lockfile
pnpm test
```

The tests run an isolated PostgreSQL-compatible PGlite instance. They need no Supabase credentials or Docker and do not change a hosted database.

## Apply the database migration

Use a development Supabase project. The migration expects Supabase's built-in `auth.users`, `auth.uid()`, and `anon`, `authenticated`, and `service_role` roles. Run `supabase/migrations/20261021000100_core_recipe_model.sql` once in the project's SQL Editor. Do not run the test setup SQL in Supabase.

No migration has been applied to a hosted project yet. Profile creation on signup and the app's Supabase connection will be added in the authentication feature. Never put a service-role key in browser code or commit credentials.

Database approach follows [Supabase user data guidance](https://supabase.com/docs/guides/auth/managing-user-data) and [row-level security guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
