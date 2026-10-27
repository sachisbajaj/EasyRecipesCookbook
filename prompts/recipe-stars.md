User story:
As a cook, I want to favorite and unfavorite recipes and open a Starred view so that reliable dinners are easy to find.

Implement Issue #11 on branch feature/add-recipe-stars. Read PLAN.md, schema.md, the existing recipe and authentication code, migrations, and tests. Follow step 5 of PLAN.md.

Requirements:
1. Add a versioned migration for public.stars with user_id referencing public.users, recipe_id referencing public.recipes, created_at, and a composite primary key on (user_id, recipe_id). Cascade recipe and account deletion and add appropriate indexes.
2. Enable row-level security. Only authenticated users may read or change their own stars, and they may star only recipes they own. Prevent changing a star's ownership or parent through updates. Anonymous users and users guessing another user's recipe ID must not gain access.
3. Add accessible star/unstar controls to recipe cards and recipe details. Keep stars independent of the numeric recipe rating. Display the saved state and prevent duplicate requests while a change is pending.
4. Add an explicit Starred view within Recipes, with navigation back to all recipes and a helpful empty state. Unstarring removes a recipe from that view without deleting it.
5. Persist stars through the Supabase client, retain them across refresh and navigation, and clear private state when the authenticated user changes. Keep recipe edits from resetting stars.
6. Handle loading and failures clearly. Failed star changes must not falsely show success or discard recipe content; allow retry. Avoid navigation when a card's star button is clicked and ignore late results after unmount/account changes.
7. Test owner star/unstar, duplicate protection, persistence, the Starred view and its empty state, failed requests, recipe/account deletion cascades, and cross-user/anonymous restrictions. Run the existing regression tests and production build.
8. Update README.md and schema.md for the new table, workflow, migration, and test instructions. Keep PLAN.md unchanged.

Only implement Stars. Leave search/filter/sort, dashboard, cooking notes, meal planning, grocery lists, and infrastructure setup for later. Do not modify or publish the separate ChatGPT Site preview.

If Supabase is not configured, continue with local implementation and tests. Distinguish isolated database tests and simulated browser tests from real Supabase checks.

Summarize the changes, test results, limitations, and proposed commit files. Do not commit or push implementation changes, open a PR, deploy, or apply hosted migrations until I approve.
