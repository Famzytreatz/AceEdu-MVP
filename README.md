# AceEdu

## Run the application

AceEdu uses a Vite React client and an Express API backed by Supabase. Copy
`.env.example` to `.env`, set a unique `SESSION_SECRET` of at least 32 bytes,
set `SUPABASE_URL` to your project URL, and set
`SUPABASE_SERVICE_ROLE_KEY` to the server-side service-role key from your
Supabase project settings. Never expose this key in the browser or commit it.
Apply the required AceEdu migrations in timestamp order in the Supabase SQL
Editor:

1. `supabase/migrations/20261021000000_initial_schema.sql`
2. `supabase/migrations/20261021130000_enrollment_profiles.sql`
3. `supabase/migrations/20261023153000_school_dashboard_analytics.sql`
4. `supabase/migrations/20261023160000_mvp_premium_entitlements.sql`
5. `supabase/migrations/20261024180000_school_spaces.sql`
6. `supabase/migrations/20261027190000_school_public_ids.sql`
7. `supabase/migrations/20261027210000_platform_premium_school_list.sql`
8. `supabase/migrations/20261027220000_premium_academic_operations.sql`

`supabase/migrations/20261021120000_eis_legacy_schema.sql` is additionally
required only for the separate EIS legacy portals. Then run `npm install` and
`npm run dev`. The client
runs on port 8443 by default and proxies `/api` requests to the API on port
3001. The development proxy targets `127.0.0.2` because VS Code may reserve
`127.0.0.1:3001` for port forwarding and respond with HTTP 426 instead of
reaching the local API. Set `API_PROXY_TARGET` only if your API runs at a
different address.

On PowerShell, you can copy the example environment with
`Copy-Item .env.example .env` and generate a local secret with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Development shows the client even if the API cannot start yet; account
registration and sign-in require a configured Supabase project and schema.

## Deploy one shared app on Render

The Express server serves the built Vite client and `/api` from the same origin
in production. To deploy both in one Render Web Service:

1. Push this project to GitHub and create a Render Web Service connected to the
   repository and branch you want to test.
2. Set the build command to `npm ci && npm run build` and the start command to
   `npm start`.
3. Add these environment variables in Render (do not commit real values):
   - `NODE_ENV` = `production`
   - `APP_ORIGIN` = the exact HTTPS URL Render assigns to the service
   - `SESSION_SECRET` = a newly generated random value of at least 32 bytes
   - `SUPABASE_URL` = your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = the Supabase server-side service-role key
   - `TRUST_PROXY` = `true`
4. Save the variables and deploy. Render supplies `PORT` automatically; do not
   set it yourself. If you need the Render URL before setting `APP_ORIGIN`, let
   the first deploy finish or fail, copy the service URL from its page, set the
   variable, then trigger **Manual Deploy ? Deploy latest commit**.
5. Check `https://your-service.onrender.com/api/health`, then share the service
   URL with collaborators so they can test the full app.

Before deploying, apply the required Supabase migrations described above. Use
test data while collaborators are testing. Never put the service-role key in
GitHub, frontend code, or a shared chat; if a real key was committed, rotate it
in Supabase. Configure Supabase backups, access controls, and monitoring for
production data.

## School accounts and data isolation

School registration saves the school and administrator profile from the
existing registration form and signs in the new administrator. Administrator
passwords are stored as bcrypt hashes. The school ID is taken from the
server-side authenticated session; admin API requests do not accept a
client-selected school ID. Every registry query and mutation is scoped to
that session's school. Supabase constraints and indexes enforce unique admin
email and school-scoped registry pagination and access PINs. API access uses
the service-role key on the server; row-level security is enabled on the
tables to block direct anonymous/authenticated access. `/api/admin/users` returns
pages of up to 50 entries, and the registry CSV is streamed instead of
buffered as one large response.
Enrollment profile passwords are stored only as bcrypt hashes; passport images
are resized in the browser before being saved with the school-scoped registry
record.

## School Spaces

Each school keeps its existing internal database ID for server-side relations
and authorization. The separate AceEdu school ID is a 32-digit random numeric
identifier generated from a cryptographically random UUID and protected by a
database unique index. It is not the school's official registration number.
The School Spaces migration derives the public slug from the school name and
the random public ID (for example, `bright-future-academy-8041...`); the
internal auto-increment ID is no longer included in the URL. Existing school
slugs will change once when the public-ID migration is applied. The slug and
public ID are locators, not authorization boundaries. School administrator
sign-in still uses the existing server session, and a sign-in from a
school-specific page is checked against that school's slug on the server.

After applying the migration, open a registered school's path-based entry at
`/s/<slug>` (for local development, for example,
`http://localhost:8443/s/bright-future-academy-42`). The registered slug is
returned with the normal school account response. The public lookup
`GET /api/schools/:slug` returns only the school name, slug, and optional HTTPS
logo URL; unknown slugs return 404. The optional `logo_url` column can be
populated with an HTTPS logo URL, but school logo upload/management is not
implemented yet.

School subdomains are not active or configured by this change. Activating
addresses such as `school.<domain>` requires choosing the canonical AceEdu
domain, configuring wildcard DNS for `*.<domain>`, provisioning a matching
wildcard TLS certificate, and configuring the deployment proxy/host routing
to reach this same app. The app currently resolves schools using `/s/:slug`;
host-based resolution must be implemented and verified after those deployment
details are known. Do not configure a DNS wildcard without confirming the
domain and hosting setup.

The branded entry reuses the existing school administrator login only. It
does not add student, teacher, parent, or sub-admin authentication. The
separately maintained `EIS-WEBSITE - Copy` portals still use their legacy
tables and authentication patterns and are not yet associated with these
school IDs.

The SQL migration creates the Supabase schema; it does not copy records from
an existing MongoDB database. Export and import any existing school or
enrollment data before removing the old MongoDB instance.

Run `npm run test:server` for server-side validation, school slug, and database
ID tests.

The separately maintained `EIS-WEBSITE - Copy` portals also use this Supabase
project. Apply `supabase/migrations/20261021120000_eis_legacy_schema.sql` for
their users, messages, content, exams, and attempts tables. Their setup and
legacy-data import notes are in `EIS-WEBSITE - Copy/README.md`.
