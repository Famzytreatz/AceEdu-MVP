# EIS legacy portals

The EIS server stores application data in Supabase; it no longer connects to
MongoDB. The AceEdu React app and EIS portals share the Supabase project but
use separate tables.

## Configure Supabase

Set `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY` in the
repository-root `.env` file for local development, or in the deployment
environment. Never place the service-role key in browser code or commit it.
The EIS server reads the repository-root `.env` file when run locally.

Apply both migrations in the Supabase SQL Editor:

1. `supabase/migrations/20261021000000_initial_schema.sql`
2. `supabase/migrations/20261021120000_eis_legacy_schema.sql`

Then install and start the EIS server from PowerShell:

```powershell
npm install --prefix "EIS-WEBSITE - Copy"
npm start --prefix "EIS-WEBSITE - Copy"
```

The server listens on port 3000 by default. Set `EIS_PORT` to use a different
port; `PORT` remains available to the AceEdu API. `/api/health` reports whether
the EIS Supabase schema is reachable.

## Existing MongoDB records

Applying the SQL migration creates the EIS tables but does not copy records
from the old local MongoDB database. Export and import users, messages,
classroom content, exams, and exam attempts before retiring the old data.
Map MongoDB ObjectIds to the new numeric IDs and update exam-attempt foreign
keys during import. For imported user passwords, place the existing password
value in `eis_users.password_hash`; a successful legacy-password login will
replace it with a bcrypt hash. New passwords are hashed before storage.

## Deployment security

The database migration does not add server-side authorization to the legacy
portals. In particular, existing admin mutation and registry endpoints still
need authenticated role checks before this app is exposed publicly. Do not
treat the Supabase service-role key or browser-side PIN checks as user
authorization.

## Run tests

```powershell
npm test --prefix "EIS-WEBSITE - Copy"
```