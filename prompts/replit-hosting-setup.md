# Replit hosting setup

Issue: #29

As a cook, I want to open my cookbook at a stable website address so I can use it from my phone or computer.

Configure the existing Vite cookbook to run in Replit Preview and publish as a static site. Bind the Vite development and preview servers to `0.0.0.0` on the Replit-provided preview port, build the existing app to `dist`, and rewrite app routes to `index.html` so direct visits and refreshes work for login, signup, auth callback, and cookbook routes.

Keep changes limited to Replit hosting configuration and the documentation needed to publish safely. Preserve the existing Vite/React app and Supabase client setup. Do not add a pnpm workspace, a new backend, or a second database. Keep Supabase URL and publishable key in Replit Secrets; never commit credentials or a service-role key. Document that the published HTTPS `/auth/callback` URL must be added to Supabase's allowed redirects.

Verify dependency installation, the production build, direct-route fallback, and the existing tests. Open a pull request targeting `main` with `Closes #29` in its description, and leave it open for review.
