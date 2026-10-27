User story:
As a cook, I want clear inline errors so that I can fix incomplete or invalid recipes without losing my work.

Implement Issue #9 on branch feature/improve-recipe-validation. Read PLAN.md, schema.md, the existing recipe forms, validation helpers, database constraints, and tests before making changes. Follow step 4 of PLAN.md. Build on the validation already implemented in recipe management and address its remaining gaps.

Requirements:
1. Require a nonblank recipe name and instructions, positive whole-number servings, and at least one valid ingredient with a nonblank name and unit.
2. Validate optional cooking time as a positive whole number, ratings as whole numbers from 1–5, and source links as complete HTTP(S) URLs. Blank optional fields must remain unset; an unrated recipe must not become zero.
3. Preserve support for positive decimal amounts, fractions such as 1/4, mixed numbers such as 1 1/2, and supported Unicode fractions. Keep support for an optional unit in the amount, such as 1/4 cup or 2tbsp. Make the relationship between an inline unit and the separate Unit field clear and consistent. Do not add unit conversion or automatic ingredient interpretation.
4. Treat only an intentionally blank amount as “as needed.” Malformed, zero, negative, nonfinite, or zero-denominator amounts must show an error and block saving. Keep the original typed text visible so the cook can correct it. Never let browser input sanitization silently turn invalid entries into blank values.
5. Show specific, helpful errors beside the affected fields, including dynamically added ingredient rows. Associate errors with their inputs using accessible labels, aria-invalid, and aria-describedby. On an invalid submission, announce a concise summary and focus the first invalid field.
6. Use consistent validation timing: avoid showing errors before a field has been interacted with or the form submitted; update or clear an existing error as the user corrects it. Adding or removing ingredient rows must not attach an error to the wrong row or leave stale errors.
7. Preserve all entered values and ingredient rows when validation, a network request, or a database save fails. Show safe, actionable save errors without exposing raw database details. Allow retry and prevent duplicate submissions while saving.
8. Keep client validation consistent with database constraints and retain atomic recipe-and-ingredient saves, the minimum-ingredient rule, and row-level security. Reuse existing constraints; add a versioned migration only if a demonstrated validation gap requires one. Do not edit already shipped migrations.
9. Add meaningful regression tests for invalid inputs and successful correction in both creation and editing. Include fractional amounts surviving save, reload, and editing; malformed fractions remaining visible and blocking save; optional blank amounts; dynamic ingredient rows; accessible error associations and focus; and preservation of values after a failed save. Run the existing isolation and rollback tests to catch regressions.
10. Update README.md with any changed validation behavior. Update schema.md only if database behavior changes. Preserve the app’s current responsive design and keep PLAN.md unchanged.

Only improve recipe validation. Leave favorites, search/filter/sort controls, dashboard, cooking-note history, meal planning, grocery lists, and infrastructure setup for later steps. Do not modify or publish the separate ChatGPT Site preview as part of this implementation.

If Supabase configuration is missing, continue with independent implementation and local tests. Clearly distinguish simulated UI/browser tests and isolated database checks from checks against a real Supabase project.

Run the relevant tests and production build, summarize the changes and results, and show the files proposed for the commit. Do not commit, push, open a PR, deploy, or apply changes to a hosted database until I approve.
