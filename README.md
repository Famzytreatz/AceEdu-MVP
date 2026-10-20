# AceEdu Frontend

A responsive React and Vite implementation of the AceEdu school-management SaaS landing page. The interface is based on the supplied desktop and mobile Figma designs and uses traditional CSS only.

## Prerequisites

- Node.js 20.19 or newer, or 22.12 or newer (Node.js 22 is recommended)
- npm 10 or newer

## Setup

```bash
npm install
npm run dev
```

Open the URL printed by Vite; the default is `http://localhost:8443/`. If port 8443 is already in use, choose another port in PowerShell and restart:

```powershell
$env:PORT = "5173"
npm run dev
```

Create a production bundle with:

```bash
npm run build
```

## Project structure

- `src/components/common` — shared brand and dashboard preview components
- `src/components/layout` — responsive header and footer
- `src/components/ui` — reusable buttons and modal form
- `src/data` — mock dashboard and marketing content
- `src/pages` — complete landing page composition
- `src/styles` — global rules, design variables, and responsive breakpoints
- `public/assets` — local Figma SVG assets

## Interactions

- Header and footer links scroll to page sections.
- The mobile navigation opens as an accessible drawer and closes on selection.
- Login, demo, and get-started actions open purpose-specific forms.
- Form validation runs in the browser and a local success state demonstrates the intended flow.

## Backend integration notes

The dashboard metrics and activities are illustrative mock data in `src/data/siteContent.js`. Authentication, demo booking, onboarding submissions, persistence, email delivery, and API calls are not connected. The modal forms intentionally keep submissions in local component state so service functions can be added later without changing the visual components.

## Source handoff

All editable source is contained in this project directory. Download or clone the complete repository, open the folder in VS Code, run `npm install`, and then use the scripts above. The preview panel itself is not an export mechanism.
