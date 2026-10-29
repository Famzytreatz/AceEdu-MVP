# AceEdu EIS Portal Migration Notes

## What changed

This update is based on the uploaded `AceEdu-MVP-main(1).zip` snapshot and the uploaded `EIS-WEBSITE - Copy.zip` source. It preserves the original EIS HTML/CSS visual system for the primary Student and Teacher portal pages instead of replacing them with a new AceEdu React dashboard design.

### Integration approach

- The original portal assets and HTML pages are served from `public/eis-portals/`.
- `src/pages/SchoolPortalPage.jsx` continues to own the authenticated AceEdu entry path and only renders the original portal page after the existing member, school-match, dashboard, role, and Premium checks are satisfied.
- The original page is loaded in a same-origin iframe to isolate its CSS from the rest of AceEdu.
- `public/eis-portals/shared/portal-client.js` bridges the legacy HTML pages to existing AceEdu APIs. It uses same-origin credentials and does not reuse the legacy EIS login/database API.

### Connected workflows

- Student dashboard, school identity, profile modal, admin transmissions, and Results Vault using returned assessment/result data.
- Student classroom/Academy Hub and examination room, including attempt start/resume, answer autosave, and submit through existing APIs.
- Teacher dashboard with assigned classroom cards.
- Teacher classroom stream, posts, permitted attachment uploads, and secure meeting URLs.
- Teacher exam creation/list/results using AceEdu APIs, including actual class, subject, and academic-term selectors.
- Student digital ID printing without displaying a reusable access PIN.

### Not yet migrated or runtime-verified

- The copied standalone `cbt-practice.html` and `subject-editor.html` legacy pages are not activated by the primary dashboard routes and have not been fully adapted to AceEdu's current APIs.
- Existing user records, Premium entitlements, Supabase migrations, and live API behaviour were not verified against a live database in this environment.
- Real browser visual comparison was not available. This change preserves the source HTML/CSS and uses structural checks, but pixel-perfect equivalence has not been measured with screenshots.
- Actual login/session, API writes, file upload, exam submission, school isolation and expired-entitlement redirect still need end-to-end verification in the user's configured environment.

## Files

Modified:
- `src/pages/SchoolPortalPage.jsx` — loads the original EIS Student/Teacher portal within the already-authorized school portal route.
- `README.md` — documents the migration architecture and workflow scope.

Added:
- `public/eis-portals/shared/portal-client.js`
- Student portal HTML, CSS, assets, and adapters under `public/eis-portals/student/`
- Teacher portal HTML, CSS, assets, and adapters under `public/eis-portals/teacher/`

## Checks run

Passed:
- `node --check` on the portal adapter JavaScript files.
- TypeScript's transpile/parse check on `src/pages/SchoolPortalPage.jsx`.
- HTML structural audit of the five active portal pages: no duplicate IDs, no inline event handler attributes, and no missing local script/link references.

Blocked/incomplete:
- `npm run build` could not run because Vite was unavailable after dependency installation timed out.
- `npm run test:server` reported 38 passing tests and 5 test files failing to start because dependencies such as `dotenv` and `express` were unavailable in the partial `node_modules` directory. This is not a clean full-suite pass.
- No live Supabase migration, live entitlement, production deployment, or browser end-to-end test was performed.

## Apply safely

The ZIPs produced from this migration are based on the uploaded project snapshot, not on direct access to the current VS Code working tree. Before applying to a newer local copy, back it up and compare/merge the changed `src/pages/SchoolPortalPage.jsx` instead of blindly overwriting it if that file has local changes. Copy the `public/eis-portals/` tree and merge the README section as needed. Do not copy `node_modules`; run the project's documented install command locally and then run the build/tests in your own environment.
