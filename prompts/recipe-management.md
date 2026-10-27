User story:
As a cook, I want to add, view, edit, and delete recipes so that I can keep my weeknight cookbook useful and up to date.

Implement Issue #7 on branch feature/add-recipe-management. Read PLAN.md, schema.md, and the existing code before making changes.

Requirements:
1. Replace the signed-in placeholder with a recipe collection showing only the current user’s recipes. Include a clear “Add recipe” action and a helpful empty state.
2. Build a recipe form with title, instructions, servings, and ingredient rows containing name, quantity, and unit. Allow adding and removing ingredient rows.
3. Include optional cooking time, store/source label, source URL, and a 1–5 rating. An unrated recipe should remain unrated rather than defaulting to zero.
4. Create a detail page showing the full recipe, ingredients, rating, and a clickable source link when provided.
5. Allow editing a recipe and its ingredients. Load existing values into the form and preserve entered values if saving fails.
6. Save recipe and ingredient changes atomically through a versioned database migration and an authenticated database function. If any part fails, roll back the entire save. Require at least one valid ingredient.
7. Add deletion with a confirmation dialog naming the recipe. Cancel must leave it unchanged; successful deletion must remove its ingredients and return to the collection.
8. Preserve row-level security. Derive ownership from the authenticated user and prevent access or changes to another user’s recipes, including through guessed URLs or direct database calls.
9. Add basic validation consistent with existing database constraints, clear loading/error states, and protection against duplicate submissions. Match the responsive design already used for signup and login.
10. Test creation, viewing, editing, deletion/cancellation, failed-save rollback, and data isolation. Given Users A and B and A’s recipe, when B requests or tries to modify it, then B cannot access or change it while A retains access.
11. Update README.md and schema.md to explain the recipe workflow and database changes.

Only implement recipe management. Leave advanced validation polish, favorites, search/filter/sort controls, dashboard, cooking-note history, meal planning, grocery lists, and automatic recipe importing for later features.

If Supabase configuration is missing, continue with independent implementation and local tests. Clearly distinguish simulated tests from checks against a real development Supabase project.

Run the tests and production build, summarize the changes and results, and show the files proposed for the commit. Do not commit, push, open a PR, or apply changes to a hosted database until I approve.
