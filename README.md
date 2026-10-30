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
9. `supabase/migrations/20261028110000_premium_operations_workflows.sql`
10. `supabase/migrations/20261028130000_school_short_slugs.sql`
11. `supabase/migrations/20261028150000_school_classroom_and_exams.sql`
12. `supabase/migrations/20261030120000_school_class_subject_choices.sql`

`supabase/migrations/20261021120000_eis_legacy_schema.sql` is additionally
required only for the separate EIS legacy portals. Then run `npm install` and
`npm run dev`. The client
runs on port 8443 by default and proxies `/api` requests to the API on port
3001. The development proxy targets `127.0.0.2` because VS Code may reserve
`127.0.0.1:3001` for port forwarding and respond with HTTP 426 instead of
reaching the local API. Set `API_PROXY_TARGET` only if your API runs at a
different address.

School setup supports Primary, Secondary, and Combined school types. Class
levels are generated from the selected type, while Primary 6 starts optional.
Administrators can nickname classes, configure class subject limits and
compulsory subjects, and review student subject combinations. Students' and
teachers' portal password changes remain school-scoped. Apply the class and
subject choices migration before using these features.

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
a short opaque suffix (for example, `bright-future-academy-7f3a9c1b2d4e8a01`);
neither internal database IDs nor the long public school ID are included in
the URL. `20261028130000_school_short_slugs.sql` updates existing slugs and
preserves old addresses as server-resolved aliases. The slug and public ID are
locators, not authorization boundaries. School administrator
sign-in still uses the existing server session, and a sign-in from a
school-specific page is checked against that school's slug on the server.

After applying the migration, open a registered school's path-based entry at
`/s/<slug>` (for local development, for example,
`http://localhost:8443/s/bright-future-academy-7f3a9c1b2d4e8a01`). The registered slug is
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

The branded school entry serves the school administrator sign-in. Student and
teacher members use the shared Premium portal sign-in described below.

The SQL migration creates the Supabase schema; it does not copy records from
an existing MongoDB database. Export and import any existing school or
enrollment data before removing the old MongoDB instance.

Run `npm run test:server` for server-side validation, school slug, and database
ID tests. The Premium operations migration adds transactional attendance and
assessment-result saves. Apply it after the academic operations migration
before using those workflows.

With an active permanent Premium plan or approved trial, the school admin
dashboard enables Academic Setup, Attendance, and Academic Records. Attendance
and assessment results are saved through school-scoped database functions.
Other advertised Premium items remain unavailable until their workflows are
implemented; an entitlement does not by itself enable an unfinished portal.

### Student and teacher portals

The path-based school space has one shared student/teacher sign-in:

- `/s/<slug>/portal` — school-branded shared sign-in; the server resolves the
  active student or teacher account from its school-issued PIN and redirects to
  the matching role-specific portal.
- `/s/<slug>/student` and `/s/<slug>/teacher` remain supported as direct
  role-specific entry paths and use the same sign-in flow.

Portal accounts use the enrollment PIN already issued by the school. A
configured password must be supplied; teacher enrollments without a password
cannot sign in, while existing PIN-only student enrollments continue to use
their PIN. The school-scoped unique PIN constraint prevents ambiguous role
resolution. Sign-in is school-slug scoped, rate limited, and
creates a server-side member session; the slug does not determine authorization.
The student and teacher APIs resolve the internal school and member IDs from
that session, require the matching member role, and enforce Premium access on
the server. Teachers can only load or save attendance for classes assigned to
them as class teacher, subject teacher, or through their school class-level
assignment. Students see only their own published results and attendance.
Class-level assignments appear in the teacher classroom even before an
academic-year class exists; posting, attendance, and exams require an academic
class and terms to be configured and linked.

These pages adapt EIS's student identity card, published results, classroom
stream, class roster, teacher posts and attachments, live-class links, exam
builder, timed multiple-choice exam room, and teacher results view to AceEdu's
school-scoped enrollment and academic records. They do not reuse EIS's separate
legacy authentication or APIs, which trust browser-stored identity and do not
enforce AceEdu school isolation. EIS comments, QR sign-in, student messaging,
and other features without an equivalent AceEdu workflow remain unavailable.
Exam answers are saved to the active school-scoped attempt as the student works
and restored when they resume the exam.

The classroom and exam APIs additionally depend on
`20261028150000_school_classroom_and_exams.sql`, which creates school-scoped
content, exams, attempts, scoring functions, and a private attachments bucket.
The existing portals depend on
`20261027220000_premium_academic_operations.sql` and
`20261028110000_premium_operations_workflows.sql` being applied successfully
for their existing academic functions. The repository cannot confirm whether
these migrations are applied to a hosted database. Applying migrations is an
explicit deployment step.

The optional `supabase/migrations/20261021120000_eis_legacy_schema.sql` is for
running the standalone EIS copy only; AceEdu does not use its legacy user,
message, content, exam, or attempt tables. Their setup and legacy-data import
notes are in `EIS-WEBSITE - Copy/README.md`.
