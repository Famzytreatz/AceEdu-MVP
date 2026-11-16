# AceEdu Registration Setup workspace

## Install

1. Extract this ZIP into the root of your `AceEdu-MVP-1` project folder and merge the `src` folder.
2. Open PowerShell in the project root.
3. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\apply-registration-workspace.ps1
```

The script updates `src/pages/AdminDashboard.jsx` to add the Registration setup navigation item and render the new workspace. It creates a one-time backup named `AdminDashboard.jsx.registration-setup.bak`.

## Verify

```powershell
npm run build
npm run test:server
```

## What this workspace does

- Loads the school's registration forms from the authenticated admin API.
- Creates additional registration form drafts.
- Edits form title, description, parent-facing introduction and submit messages.
- Adds and edits sections and fields.
- Keeps AceEdu standard fields mapped to the existing student profile model.
- Adds school-specific custom fields, choice options and data-handling classifications (standard, sensitive or restricted).
- Previews the form in a parent-facing layout.
- Saves draft versions and publishes a selected draft through the backend.

## Important scope note

This is the first usable Form Builder and publishing workspace. It does not yet upload existing paper/PDF/image forms, run OCR or call an AI provider. Those features are the next phase after this builder has been tested against the live APIs.

The workspace uses the registration API helpers already added to `src/data/api.js`. It does not require a new npm package or another database migration.
