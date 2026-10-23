# AceEdu

## Run the application

AceEdu uses a Vite React client and an Express API backed by Supabase. Copy
`.env.example` to `.env`, set a unique `SESSION_SECRET` of at least 32 bytes,
set `SUPABASE_URL` to your project URL, and set
`SUPABASE_SERVICE_ROLE_KEY` to the server-side service-role key from your
Supabase project settings. Never expose this key in the browser or commit it.
Apply `supabase/migrations/20261021000000_initial_schema.sql` in the Supabase
SQL Editor and `supabase/migrations/20261021130000_enrollment_profiles.sql`
for the dashboard's extended enrollment profiles, then run `npm install` and
`npm run dev`. The client runs on port 8443 by default and proxies `/api`
requests to the API on port 3001.

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

The SQL migration creates the Supabase schema; it does not copy records from
an existing MongoDB database. Export and import any existing school or
enrollment data before removing the old MongoDB instance.

Run `npm run test:server` for server-side validation and database ID tests.

The separately maintained `EIS-WEBSITE - Copy` portals also use this Supabase
project. Apply `supabase/migrations/20261021120000_eis_legacy_schema.sql` for
their users, messages, content, exams, and attempts tables. Their setup and
legacy-data import notes are in `EIS-WEBSITE - Copy/README.md`.
