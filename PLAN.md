# EasyRecipesCookbook — App Plan

## 1. Pitch
I'm building EasyRecipesCookbook because I want one place to keep easy weeknight meals, such as Trader Joe's combinations, remember what to improve next time, rate recipes, and shop for meals I plan to cook. I expect to use it weekly for planning and shopping and after cooking to add notes. Other users can create their own private cookbooks.

## 2. Features and build order
Build the following features in order, starting with persistent data and private accounts.

1. **Data model:** As a cook, I want recipes, ingredients, and my account connected in a database so that my cookbook persists. Create users, recipes, and ingredients, ownership policies, migrations, and schema.md; add later tables with their owning features.
2. **Sign up and login:** As a visitor, I want to sign up with email/password, log in, and log out so that only I can access my data. Create a public users row automatically for every account. New users start with an empty cookbook.
3. **Recipe CRUD:** As a cook, I want to add, list, open, edit, and delete recipes so that my collection stays useful. Fields: title, instructions, ingredients with quantities/units, servings, optional minutes, optional store/source label, optional source URL, and optional 1–5 rating. Deletion requires confirmation and explains removal of attached notes and meal-plan entries.
4. **Validation:** As a cook, I want clear inline errors so that I can fix incomplete recipes. Require nonblank title/instructions, at least one named ingredient, and positive servings. Optional quantities and minutes must be positive; ratings are whole numbers 1–5; links must use HTTP(S). Preserve form input after errors. Database constraints accompany UI validation; basic constraints ship with the schema.
5. **Stars:** As a cook, I want to favorite/unfavorite recipes and open a Starred view so that reliable dinners are easy to find. Use one shared stars junction table, with one row per user/recipe pair.
6. **Find things:** As a cook, I want title search, a store filter such as Trader Joe's, and sorting by newest, highest rating, or shortest time so that I can choose dinner quickly. Missing ratings/times sort last.
7. **Dashboard:** As a cook, I want total recipes, average recipe rating, and starred count plus a bar chart of recipe counts by rating so that I can understand my collection. Exclude unrated recipes from the average; show “Not rated yet” when none are rated. Include an Unrated chart bucket.
8. **Cooking-note history:** As a cook, I want dated notes for each time I cook a recipe, with “what worked” and “next time” fields, so that I retain lessons. Add/edit/delete entries; require at least one note field. Show newest first. Recipe rating remains my current overall verdict, independent of note history.
9. **Meal plan:** As a cook, I want to choose recipes, dates, and serving counts for a selected week so that I know what I am planning to cook. Permit multiple meals on a date and repeated recipes; allow changing/removing entries.
10. **Grocery list:** As a cook, I want an editable checklist generated from that week's meals so that I can shop once. Scale ingredient quantities by planned/base servings. Combine only matching normalized ingredient names and units; keep different products/units separate. Retain unquantified items as “as needed.” Allow manual additions, quantity edits, deletion, and check-off for bought/already-owned items. Persist one list per user/week. Generation is an explicit snapshot; regenerating warns that it replaces that week's edits/checkmarks. Recipe edits never silently change a shopping list.

Workflow: browse recipes → plan meals → generate/check grocery list → cook → add a note and update rating. Source URLs are saved links; ingredients and instructions are entered manually.

## 3. Database
Types: UUID = unique identifier; text = words; integer/decimal = numbers; date/timestamp = dates; boolean = true/false. PK = primary key; FK = reference to another table. Fields are required unless marked optional.

| Table | Columns |
| --- | --- |
| users | id UUID PK/FK → auth.users.id; display_name text optional; created_at timestamp |
| recipes | id UUID PK; user_id UUID FK → users; title text; instructions text; servings integer; minutes integer optional; store text optional; source_url text optional; rating integer optional; created_at timestamp; updated_at timestamp |
| ingredients | id UUID PK; recipe_id UUID FK → recipes; name text; quantity decimal optional; unit text (default “item”); position integer |
| stars | user_id UUID FK → users; recipe_id UUID FK → recipes; created_at timestamp; composite PK (user_id, recipe_id) |
| cooking_notes | id UUID PK; recipe_id UUID FK → recipes; cooked_on date; what_worked text optional; next_time text optional; created_at timestamp |
| meal_plan_entries | id UUID PK; user_id UUID FK → users; recipe_id UUID FK → recipes; planned_date date; servings integer |
| grocery_items | id UUID PK; user_id UUID FK → users; week_start date (Monday); name text; quantity decimal optional; unit text; checked boolean default false; position integer |

Supabase also manages auth.users: its id UUID is the account key; email and password authentication are handled by Auth, not copied into recipe tables.

Relationships: users 1→many recipes; recipes 1→many ingredients and cooking_notes; users many↔many recipes through stars; users 1→many meal_plan_entries and grocery_items; recipes 1→many meal_plan_entries. Although stars is a junction, users may only star their own recipes.

Enforce row-level security for all reads/writes: user_id must match the signed-in user; child records require ownership of their parent recipe. Meal-plan and star writes also verify recipe ownership. A guessed ID must never bypass privacy. Account deletion cascades through owned data; recipe deletion cascades to ingredients, notes, stars, and planned meals. Grocery snapshots remain independent. No shared/public recipe library in version 1.

## 4. Tests
**Data isolation:** Given Users A and B and A's recipe/ingredients, when B lists recipes and requests A's known recipe ID using B's authenticated session, then B sees none of A's records and cannot update/delete them. Also verify A can still read the record. Extend isolation coverage when later private tables are added. This checks database access, not merely hidden UI. What would break it: removing or broadening a recipe/child ownership policy.

**Dashboard:** Given A's recipes rated 5, 3, and unrated, plus B's recipe rated 1, when A opens the dashboard, then the average is 4.0 and the recipe count is 3. Empty ratings display “Not rated yet.” This checks the value actually shown by the dashboard. What would break it: including unrated recipes as zero or including another user's records.

Also test grocery arithmetic (same unit merge, different units, serving scaling, unknown amounts) and manually verify signup, confirmation dialogs, mobile use, and persistence after reload.

## 5. Technologies
- **Codex:** coding agent for small, explainable changes; Sachi chooses scope, tries the app, and merges PRs.
- **React + TypeScript + Vite:** a browser UI with typed recipe data and a straightforward build; plain CSS supplies the visual style.
- **React Router:** separate recipe, planner, grocery, dashboard, and account screens with navigable URLs.
- **Supabase PostgreSQL + Auth + JavaScript client:** relational storage and email/password accounts in one service; row-level security protects every user's records. Verify confirmation-email delivery and signup before launch.
- **Vercel:** proposed hosting for the Vite app with previews and deployments from GitHub; configure SPA route fallback and environment variables.
- **Recharts:** a rating-distribution chart; **Vitest** for calculations and database integration checks; **Playwright** for browser flows and dashboard assertions.
- **GitHub Issues, PRs, and Actions:** work tracking, reviewable changes, and build/test checks.

Architecture: browser UI → Supabase client with authenticated session → database policies → stored rows. Only the public project URL/publishable key belongs in the browser; privileged keys stay out of frontend code and Git. Track SQL in supabase/migrations, UI in src, tests in tests, and prompts in prompts. 

References: [Supabase Auth](https://supabase.com/docs/guides/auth), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Vite hosting](https://vercel.com/docs/frameworks/frontend/vite).

## 6. Design
A warm, uncluttered recipe notebook: cream #FFF8EE background, dark brown #29231F text, terracotta #A9432E primary actions, and sage #45644A accents. Borrow recipe organization from Paprika and readable checklist simplicity from Apple Reminders. Use cards with titles, time, rating, and favorite buttons; avoid requiring photos. Navigation: Recipes, Meal Plan, Grocery List, Dashboard; Starred lives inside Recipes. Forms have visible labels, clear focus states, accessible contrast, and touch-friendly controls. Recipe detail puts ingredients/steps before source links and cooking history. Use friendly empty states with one clear next action.

## 7. Risks and cuts
The hardest feature is ingredient aggregation. Limit the first version to trimmed/case-insensitive exact names and matching units. Do not infer that “TJ's cauliflower gnocchi” is ordinary gnocchi or convert cups to grams. Defer photo uploads, automatic URL importing, nutrition, AI suggestions, sharing, and calendar drag-and-drop. Prioritize reliable recipe management, cooking notes, meal planning, and grocery lists.

## 8. Plan vs. Reality
Record changes to the original plan here as the app is built, including what shipped, what changed, and why.

| Planned feature | Shipped / Changed / Cut | Status (Done / Backlogged) | Learning | What changed and why |
| --- | --- | --- | --- | --- |
