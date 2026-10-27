User story:
As a cook, I want title search, a store filter such as Trader Joe's, and sorting by newest, highest rating, or shortest cooking time so that I can choose dinner quickly.

Implement Issue #13 on feature/search-filter-sort-recipes. Read PLAN.md, schema.md, the current collection/Stars implementation, and tests. Follow step 6 of PLAN.md. This branch starts from feature/add-recipe-stars; preserve those changes.

Requirements:
1. Add a labeled title search, a store/source-label filter, and sort choices for newest, highest rating, and shortest cooking time. Default to newest. Match the existing responsive design.
2. Search titles with case-insensitive literal substring matching and trim surrounding search whitespace. Filter by normalized store/source label (trim and case-fold); show readable labels from the user's recipes. Provide All stores and No store/source options without collisions with actual store names.
3. Combine search, store, sort, and the existing Starred view. Missing ratings or cooking times sort last. Use deterministic ties (newest then recipe ID) and never mutate the underlying collection.
4. Show a clear no-results state distinct from an empty cookbook or empty Starred view. Provide a reset action, result count, and accessible controls.
5. Preserve control state in the URL so refresh and browser Back/Forward behave predictably. Keep controls when switching between All recipes and Starred. Avoid exposing another account's recipe data or retaining private data after an account switch.
6. Use the existing owner-scoped, paginated recipe reads and row-level security. For this initial cookbook, client-side filtering of the complete loaded collection is acceptable; do not silently filter only an API's first page. Document that behavior and its scale limitation.
7. Preserve recipe creation, editing, deletion, star changes, and error/retry behavior. A failed load must not appear to be an empty result. Do not add database migrations unless a demonstrated requirement needs one.
8. Test combined filters, casing/whitespace, literal punctuation, missing values last, ties, clearing controls, no-results and empty states, Starred behavior, navigation/refresh, and owner isolation. Run existing tests and the production build.
9. Update README.md with control behavior and any limitations; update schema.md only if database behavior changes. Keep PLAN.md unchanged.

Only implement search/filter/sort. Leave dashboard, cooking notes, meal planning, grocery lists, infrastructure, and ChatGPT Site preview updates for later.

If Supabase is not configured, continue locally and distinguish simulated browser/identity tests from real hosted checks. Summarize results and proposed files. Do not commit or push implementation changes, open a PR, merge branches, deploy, or apply hosted migrations until I approve.
