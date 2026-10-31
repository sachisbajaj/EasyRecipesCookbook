Implement weekly meal planning from PLAN.md and issue #19.

As a cook, I want to choose recipes, dates, and serving counts for a selected week so I know what I am planning to cook.

Add a versioned migration for meal_plan_entries with id, user_id, recipe_id, planned_date, and servings. Require valid calendar dates and positive whole-number servings. Add keys/indexes, account and recipe cascades, and row-level security for owner-only access. Verify recipe ownership on insert and update and prevent ownership changes.

Add a Meal Plan page to cookbook navigation. Use Monday-based weeks, allow selecting a date/week and moving between weeks, and preserve the selected week in the URL. List seven days with planned recipes and serving counts. Support adding, editing, and removing entries, including multiple meals on one day and repeated recipes. Only offer owned recipes. Default servings to the recipe's base servings when selected. Require a date within the selected week; preserve entered values on failure, confirm removal, and guard pending operations and stale results after week/account changes. Provide loading, error/retry, and empty states with a path to create recipes. Explain that recipe deletion removes planned meals.

Keep the existing visual style and mobile usability. Document tables, policies, setup, and test limitations. Verify database isolation, ownership checks, validation, and cascades locally; test week boundaries, repeated meals, edit/remove/cancel, persistence, and responsive browser flows. Run existing checks and build.

Do not implement grocery lists in this feature. Do not apply hosted migrations or publish the site. Show the changes and results for review before committing/pushing implementation or opening/merging its PR.
