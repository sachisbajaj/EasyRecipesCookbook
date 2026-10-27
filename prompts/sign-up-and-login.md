User story:
As a visitor, I want to sign up with email/password, log in, and log out so that only I can access my data.

Implement Issue #5 on branch feature/add-sign-up-and-login. Read PLAN.md and inspect the existing data model before making changes.

Requirements:
1. Set up the React, TypeScript, and Vite app with routing and a responsive interface following the design in PLAN.md.
2. Configure the Supabase client using environment variables. Add an .env.example with placeholders. Never commit credentials or expose a service-role key in browser code.
3. Build signup and login forms with email/password fields, clear validation, loading states, and friendly error messages.
4. Handle email confirmation when enabled, including instructions to check email and a working return URL.
5. Add a versioned migration that automatically creates one public.users profile for each new auth.users account. Create missing profiles for existing accounts without duplicates and preserve ownership policies.
6. Restore valid sessions after refresh and protect signed-in routes. Logout must clear user-specific UI state and return the user to login.
7. Show new users a simple empty-cookbook landing screen. Switching accounts must never display the previous user’s information.
8. Update README.md with setup and authentication instructions, and schema.md with profile-creation behavior.
9. Test profile creation, form validation, session handling, logout, and protected routes. Verify real signup and login against a development Supabase project when available. Clearly distinguish simulated tests from live checks.

Only implement the authentication flow and the app structure needed to support it. Leave recipe management, stars, dashboard, cooking notes, meal planning, and grocery lists for later features.

If Supabase configuration is missing, continue with independent implementation and local tests, then explain what is needed to verify real authentication.

Run the tests, summarize the changes and results, and show the files proposed for the commit. Do not commit, push, open a PR, or apply changes to a hosted database until I approve.
