# EasyRecipesCookbook database

The database implements users, recipes, ingredients, and stars from PLAN.md. The SQL sources are `supabase/migrations/20261021000100_core_recipe_model.sql` `supabase/migrations/20261021000200_auth_profiles.sql`, and `supabase/migrations/20261027000100_recipe_management.sql`, and `supabase/migrations/20261027000200_recipe_stars.sql`.

## Relationships

```mermaid
erDiagram
    AUTH_USERS ||--|| USERS : has_profile
    USERS ||--o{ RECIPES : owns
    RECIPES ||--|{ INGREDIENTS : contains
    USERS ||--o{ STARS : saves
    RECIPES ||--o{ STARS : receives
```

Supabase manages `auth.users`, including authentication credentials. `public.users` holds app profiles. Here, `public` is a database schema name: profiles are private under row-level security.

## users

| Column | PostgreSQL type | Rules |
| --- | --- | --- |
| id | uuid | Primary key; references auth.users.id; account deletion cascades |
| display_name | text | Optional |
| created_at | timestamptz | Required; defaults to current time |

The auth profile migration automatically creates exactly one profile after each auth.users insert and backfills missing profiles for existing accounts. Existing names are preserved. Authenticated clients may read their own profile and update only its display name; browser INSERT permission is removed. Users cannot delete their profile directly; account deletion is handled by the authentication service.

The trigger runs a SECURITY DEFINER function with a fixed empty search_path and fully qualified table names. It is not executable by public, anon, or authenticated clients. It inserts only the account ID, never trusts user metadata for permissions, and lets database failures roll back account creation rather than silently losing the profile. The trigger is installed before the backfill in the same transaction. The primary key and ON CONFLICT prevent duplicates.

## recipes

| Column | PostgreSQL type | Rules |
| --- | --- | --- |
| id | uuid | Primary key; generated automatically |
| user_id | uuid | Required; references users.id; profile deletion cascades |
| title | text | Required; cannot be blank or whitespace-only |
| instructions | text | Required; cannot be blank or whitespace-only |
| servings | integer | Required; greater than zero |
| minutes | integer | Optional; greater than zero when present |
| store | text | Optional store/source label |
| source_url | text | Optional HTTP(S) link with nonempty host and no whitespace |
| rating | integer | Optional; 1–5 |
| created_at | timestamptz | Required; defaults to current time |
| updated_at | timestamptz | Required; refreshed by trigger on recipe updates |

Owners can create, read, edit, and delete recipes. They cannot change ownership, IDs, or timestamps through the client. An index on user_id supports ownership checks and listing. The URL constraint is a basic database guard; full URL parsing and friendly validation belong in the form feature.

## ingredients

| Column | PostgreSQL type | Rules |
| --- | --- | --- |
| id | uuid | Primary key; generated automatically |
| recipe_id | uuid | Required; references recipes.id; recipe deletion cascades |
| name | text | Required; cannot be blank or whitespace-only |
| quantity | numeric | Optional; finite and greater than zero; null means “as needed” |
| unit | text | Required; defaults to “item”; cannot be blank |
| position | integer | Required; defaults to zero; nonnegative display order |

Access depends on ownership of the parent recipe. Both the old and new parent must be owned by the caller when changing recipe_id. An index on (recipe_id, position) supports ingredient lookup and ordering. Positions need not be unique; the UI can use id as a stable tie-breaker.

## stars

| Column | PostgreSQL type | Rules |
| --- | --- | --- |
| user_id | uuid | References users.id; account/profile deletion cascades |
| recipe_id | uuid | References recipes.id; recipe deletion cascades |
| created_at | timestamptz | Required; defaults to current time |

The composite primary key (user_id, recipe_id) prevents duplicate stars and supports user lookups. A separate recipe_id index supports recipe deletion. Users may read, insert, and delete only their own stars for recipes they own. Anonymous clients have no table access. Clients cannot update either key or created_at; star/unstar is insert/delete. The client inserts with ON CONFLICT DO NOTHING for idempotent star requests. Unstarring is an owner-scoped delete. Recipe edits retain stars because the parent recipe ID is unchanged. Stars do not change the numeric recipe rating.

## Security and deletion

All seven tables enable row-level security. Anonymous clients have no table access. Authenticated users see only their own rows, even when another user's ID is known. Explicit column grants prevent clients from changing recipe ownership or managed timestamps. Service-role operations are privileged and must remain server-side.

Deleting a recipe deletes its ingredients, stars, cooking notes, and planned meals. Deleting an auth account deletes its profile, recipes, ingredients, stars, cooking notes, planned meals, and grocery items.

## Feature boundaries

### Atomic recipe saves

`public.save_recipe(p_recipe jsonb, p_ingredients jsonb, p_id uuid default null)` returns the saved recipe UUID. Omit `p_id` for creation; supply an owned recipe ID for editing. Recipe JSON contains title, instructions, servings, minutes, store, source_url, and rating. Ingredient JSON is a nonempty array of name, quantity, and unit objects; array order becomes position. Missing quantities become null; missing/blank units default to item. The form requires an explicit unit and initially fills item.

The function derives ownership exclusively from `auth.uid()`, uses SECURITY INVOKER with an empty search_path, and is executable only by authenticated users. Existing RLS and column grants still apply. Unknown and inaccessible recipe IDs both raise “Recipe not found.” It replaces ingredients within the same transaction as the recipe update; validation failures roll back everything, including title and timestamp changes. Ingredient IDs are regenerated on edit. It never accepts ownership changes.

Deferred constraint triggers require at least one ingredient when a recipe insert/update or ingredient removal/move commits. This permits temporary empty ingredients inside the save transaction but rejects incomplete direct writes. Existing empty recipes from before this migration are not automatically changed; they must gain an ingredient when edited. Deleting a recipe or account still cascades normally.

Recipe updates serialize concurrent RPC edits. A BEFORE DELETE/UPDATE ingredient trigger also writes the old parent recipe, serializing direct removals and preventing write skew at repeatable-read isolation. This refreshes the parent’s updated_at timestamp for direct ingredient changes. Conflicting transactions may need retry after a deadlock/serialization error. The local single-connection tests verify constraints and rollback, not concurrent server behavior; validate that separately on development PostgreSQL.

No table columns or ownership policies change in this migration.

All planned tables now have versioned migrations. The original PLAN.md is unchanged.

## Verification

Run `pnpm install --frozen-lockfile` and `pnpm test`. Tests apply the migration to an isolated PGlite database, create two identities, and exercise SQL as the authenticated/anonymous roles. Coverage includes private reads/writes, guessed IDs, forbidden parent changes, validation, timestamps, and cascading deletion.

The test-only auth schema and auth.uid() stand-in simulate identity supplied by Supabase. They do not test token verification, confirmation email, real signup, or the hosted API. The authentication feature includes additional simulated UI and browser tests; the real development-project checks remain pending until Supabase is configured. See README.md for the checklist.

## cooking_notes

Introduced by `20261030000100_cooking_notes.sql`.

| Column | PostgreSQL type | Rules |
| --- | --- | --- |
| id | uuid | Primary key; generated automatically; immutable to clients |
| recipe_id | uuid | Required FK to recipes.id; cascade deletion; immutable to clients |
| cooked_on | date | Required finite calendar date in years 0001–9999 |
| what_worked | text | Optional; at least one of the two text fields must contain non-whitespace content |
| next_time | text | Optional; same content constraint |
| created_at | timestamptz | Required; defaults to now(); immutable to clients |

The index `(recipe_id, cooked_on DESC, created_at DESC, id DESC)` supports recipe history in deterministic newest-first order. RLS checks ownership of the parent recipe for reads, inserts, updates, and deletes. Anonymous users have no grants. Authenticated users may insert only recipe_id and the three editable fields; updates may change only cooked_on, what_worked, and next_time. This prevents reparenting even to another owned recipe. Service-role access remains privileged.

Each note save is a single insert or update. It never updates the recipe rating or replaces other history. Recipe edits preserve notes through the stable recipe ID. Recipe and account deletion cascade to history.

## meal_plan_entries

Introduced by `20261031000100_meal_planning.sql`.

| Column | PostgreSQL type | Rules |
| --- | --- | --- |
| id | uuid | Generated primary key; immutable to clients |
| user_id | uuid | Required FK to users.id; deletion cascades; immutable to clients |
| recipe_id | uuid | Required FK to recipes.id; deletion cascades |
| planned_date | date | Required finite calendar date in years 0001–9999 |
| servings | integer | Required; greater than zero |

An index on `(user_id, planned_date, id)` supports weekly owner reads; a recipe_id index supports recipe cascades. No uniqueness rule limits meals per day or repetitions. Each entry's servings are independent of the recipe's base servings.

RLS permits only the entry owner to read, insert, edit, or delete, and verifies that the referenced recipe also belongs to that owner on both existing and new rows. Column grants prevent client changes to id or user_id. Users may switch to another recipe they own. Anonymous access is denied. Deleting a recipe or an auth account cascades to associated planned meals. No grocery snapshot is generated or modified by planner operations.

## grocery_items

Introduced by `20261031000200_grocery_lists.sql`.

| Column | PostgreSQL type | Rules |
| --- | --- | --- |
| id | uuid | Generated PK; immutable to clients |
| user_id | uuid | Required FK to users.id; account deletion cascades; immutable |
| week_start | date | Required Monday in a complete supported week; immutable |
| name | text | Required non-whitespace content |
| quantity | numeric | Optional finite positive value; null means “as needed” |
| unit | text | Required non-whitespace content |
| checked | boolean | Required; defaults false |
| position | integer | Required nonnegative integer; defaults zero |

The `(user_id, week_start, position, id)` index supports ordered per-week lists. All entries for an owner/week constitute that week's single checklist. No recipe foreign key exists: snapshots remain after recipe changes/deletion. Account deletion removes lists. RLS restricts every operation to the owner, and column grants forbid client changes to id, user_id, or week_start. Anonymous access is denied. Owners may edit item content, checkmarks and position or delete rows.

`generate_grocery_list(p_week date)` is a SECURITY INVOKER function with an empty search_path. It derives ownership from auth.uid(), validates a Monday week, acquires a transaction advisory lock for that owner/week, deletes that week's rows, and inserts scaled/aggregated owned meal ingredients in the same transaction. Exceptions roll back the entire replacement. Execution is granted only to authenticated clients; RLS remains active. Two generations for the same owner/week cannot interleave their delete/insert operations; separate users/weeks remain independent.

The amount is ingredient quantity × meal servings ÷ recipe servings, calculated with PostgreSQL numeric arithmetic. Grouping keys are lowercase, whitespace-collapsed, trimmed name and unit, plus whether quantity is unknown. Known quantities sum; unknown amounts retain a separate null row. Display names preserve a representative normalized spelling; unit labels use the normalized unit. Different units/products never merge. Generated positions follow normalized name/unit order, and all generated checkmarks start false. Manual items default to position zero; ID breaks ties. Empty generations leave no rows; the UI treats an empty generated list and a not-yet-generated list identically.
