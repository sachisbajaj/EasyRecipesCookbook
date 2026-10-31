Implement cooking-note history from PLAN.md and issue #17.

As a cook, I want dated notes for each time I cook a recipe so that I retain lessons.

Add a versioned migration for cooking_notes (id, recipe_id, cooked_on, what_worked, next_time, created_at). Require a valid date and at least one nonblank note field. Add primary/foreign keys, a recipe/date index, cascade deletion, and row-level security through the parent recipe. Prevent reparenting and anonymous or cross-user access.

On recipe details, support adding, editing, and deleting entries with a cooking date, “What worked,” and “Next time.” Show newest cooking dates first with deterministic tie ordering. Keep recipe ratings independent. Preserve input on failure, show clear validation and loading/error/empty states, confirm deletion, and prevent stale private data when navigating or changing accounts. Match the existing responsive design.

Document the schema and setup. Test database permissions, validation, cascades, and permitted operations in an isolated database; test the note UI and browser flow, and run existing checks. Explain test-environment limitations.

Leave meal planning, grocery lists, hosting, and production database setup for later. Show changes and test results for review before committing or pushing implementation, opening its PR, merging, or publishing.
