User story:
As a cook, I want total recipes, average recipe rating, and starred count plus a bar chart of recipe counts by rating so that I can understand my collection.

Implement Issue #15 on feature/add-cookbook-dashboard. Read PLAN.md, schema.md, existing recipes/Stars/authentication code, and tests. Follow step 7 of PLAN.md.

Requirements:
1. Add a private Dashboard screen with navigation to and from Recipes.
2. Show total owned recipes, average rating to one decimal place, and starred recipe count. Exclude unrated recipes from the average; show “Not rated yet” when none are rated. Stars remain independent of ratings.
3. Use Recharts for a responsive bar chart of counts for ratings 1 through 5 plus Unrated. Include zero-count categories and accessible labels/text values so the information is available without relying on color or pointer hover.
4. Use the complete owner-scoped, paginated collection. Dashboard totals must not inherit collection search/filter controls. Preserve RLS and never display another user's data. Clear private results when the session changes and ignore stale responses.
5. Provide loading, error/retry, and empty states. Failed or partial reads must not display fabricated zero totals. Refresh data when the dashboard is revisited after recipe edits, deletion, or star changes.
6. Test the PLAN.md case: A has recipes rated 5, 3, and unrated; B has a recipe rated 1. A must see total 3 and average 4.0. Cover stars, every chart bucket, all-unrated and empty data, pagination, failures/retry, navigation refresh, and account isolation.
7. Match existing responsive styling. Keep chart code separate/lazy-loaded where practical. Update README.md with behavior and tests; update schema.md only if schema behavior changes. No migration is expected; keep PLAN.md unchanged.
8. Run relevant unit, interface, database, and browser regressions and the production build. Clearly distinguish isolated/simulated tests from real Supabase verification.

Only implement Dashboard. Leave cooking-note history, meal planning, grocery lists, infrastructure, and ChatGPT Site preview updates for later.

Summarize changes, results, limitations, and proposed files. Do not commit or push implementation changes, open a PR, merge, deploy, or apply hosted migrations until I approve.
