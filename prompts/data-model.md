User story:
As a cook, I want recipes, ingredients, and my account connected in a database so that my cookbook persists.

Requirements:
1. Create a versioned Supabase PostgreSQL migration for users, recipes, and ingredients using the columns, types, and relationships in PLAN.md.
2. Add primary keys, foreign keys, appropriate indexes, timestamps, and cascading deletion rules.
3. Validate required text, positive servings and quantities, optional positive cooking time, ratings from 1–5, and HTTP(S) source links.
4. Enable row-level security on every table. Users can only read or change their own records. Ingredients inherit access through their parent recipe. Prevent unauthorized ownership changes.
5. Keep authentication credentials in Supabase Auth and reference auth.users from the application’s users table.
6. Document the implemented tables, columns, relationships, and access rules in schema.md. Add setup and test instructions to README.md.
7. Test the migration in an isolated database. Verify cross-user and anonymous access restrictions, validation, permitted owner operations, and cascading deletions. Explain any limitations of the test environment.

Only implement the core data model. Leave signup screens, automatic profile creation on signup, recipe UI, stars, cooking notes, meal planning, and grocery lists for later features. Document how the future recipe-creation flow will save a recipe and its ingredients atomically.

Run the tests, summarize the changes and results, and show the files proposed for the commit. Do not commit, push, open a PR, or apply changes to a hosted database until I approve.
