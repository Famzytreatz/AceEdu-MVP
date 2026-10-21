# AceEdu

## Run the application

AceEdu uses a Vite React client and an Express API backed by Supabase. Copy
`.env.example` to `.env`, set a unique `SESSION_SECRET` of at least 32 bytes,
set `SUPABASE_URL` to your project URL, and set
`SUPABASE_SERVICE_ROLE_KEY` to the server-side service-role key from your
Supabase project settings. Never expose this key in the browser or commit it.
Apply `supabase/migrations/20261021000000_initial_schema.sql` in the Supabase
SQL Editor, then run `npm install` and `npm run dev`. The client runs on port
8443 by default and proxies `/api` requests to the API on port 3001.

On PowerShell, you can copy the example environment with
`Copy-Item .env.example .env` and generate a local secret with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Development shows the client even if the API cannot start yet; account
registration and sign-in require a configured Supabase project and schema.

For a production deployment, set `NODE_ENV=production`, `APP_ORIGIN` to the
exact public HTTPS origin of the client, and `TRUST_PROXY=true` only when the
application is behind a trusted reverse proxy. Run `npm start` to start the
API. Configure Supabase backups, access controls, TLS, and monitoring at the
database/deployment provider; these are important for preserving school data
and are not provided by the local development setup.

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

The SQL migration creates the Supabase schema; it does not copy records from
an existing MongoDB database. Export and import any existing school or
enrollment data before removing the old MongoDB instance.

Run `npm run test:server` for server-side validation and database ID tests.

The separately maintained `EIS-WEBSITE - Copy` portals also use this Supabase
project. Apply `supabase/migrations/20261021120000_eis_legacy_schema.sql` for
their users, messages, content, exams, and attempts tables. Their setup and
legacy-data import notes are in `EIS-WEBSITE - Copy/README.md`.
