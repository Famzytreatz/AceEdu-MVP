# AceEdu Registration Backend — apply instructions

This bundle adds the first server-side form-management layer. It does not replace the existing student admission endpoint or change existing student rows.

## 1. Extract the bundle

Extract this ZIP into the root of `AceEdu-MVP`, preserving the folder structure. Merge the included `server/`, `src/`, and `supabase/` folders with the existing ones.

## 2. Apply the two small integrations automatically

Open PowerShell in the AceEdu project root and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\apply-registration-backend.ps1
```

The script safely adds the registration router import and mount to `server/routes/admin.js`, then adds five registration API helpers to `src/data/api.js`. It checks for existing insertions so running it again won't duplicate them.

If the script reports that an insertion point was not found, do not replace either full file. Use the exact manual insertions below.

### Manual fallback: `server/routes/admin.js`

Find:

```js
import communicationsRouter from "./communications.js"
```

Add directly below:

```js
import registrationRouter from "./registration.js"
```

Then find:

```js
router.use("/communications", communicationsRouter)
```

Add directly below:

```js
router.use("/registration", registrationRouter)
```

### Manual fallback: `src/data/api.js`

Find:

```js
export async function createEnrollment(values) {
  return postJson("/api/admin/users", values)
}
```

Copy all five exported functions from `src/data/registration-api-snippet.js` directly below that function. They use the existing private helpers `readJson`, `getOnce`, and `postJson`, so they must be placed inside `api.js`, not imported as another module.

## 3. Migration history

The SQL migrations in this bundle have already been applied to the connected Supabase project. Keep their files in `supabase/migrations/` so the repository history matches the database. Do not execute these two SQL files again manually.

- `20261116152020_publish_school_registration_form.sql`
- `20261116152106_publish_registration_field_guard.sql`

## 4. Test

Run from the project root:

```powershell
node --test server/registration-validation.test.js
node --test src/data/registration-api.test.js
npm run test:server
npm run build
```

## 5. New backend endpoints

All endpoints are school-admin authenticated through the existing `/api/admin` middleware:

- `GET /api/admin/registration/forms` — creates a standard default form on first access, then lists the school's forms.
- `POST /api/admin/registration/forms` — creates another form with an initial draft version.
- `GET /api/admin/registration/forms/:formId` — returns a form and its version history.
- `PUT /api/admin/registration/forms/:formId/draft` — saves the current draft or creates the next draft version after a published version.
- `POST /api/admin/registration/forms/:formId/publish` — publishes a selected draft and synchronises its custom-field definitions in one database transaction.

The existing `/api/admin/users` endpoints are unchanged. The visual Form Setup workspace and completed-student-submission workflow are the next implementation steps, not part of this backend bundle.
