
# AceEdu modal update

## Files
- `src/components/ui/Modal.jsx` — separate Login, School Registration, and Book a Demo flows.
- `src/components/ui/Modal.css` — responsive styles using the existing AceEdu CSS variables.
- `src/pages/HomePage.jsx` — passes the modal-switch callback into the modal.

## Apply
Copy these files into the matching paths in your existing AceEdu project, replacing those files. Keep your existing `Button.jsx`, `Button.css`, global styles, and design tokens.

## Important limitation
This is a frontend-only prototype. It validates inputs and explicitly tells users when an action has not been sent. It does not create school accounts, authenticate users, send demo requests, or store passwords. Connect the forms to a real backend/authentication provider before production.

## Run
Use the scripts already defined in your project's `package.json`. For a typical Vite project, `npm run dev` starts the development server.

