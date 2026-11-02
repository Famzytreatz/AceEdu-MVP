AceEdu Admin Dashboard visual refresh

The refresh CSS from AceEdu-Admin-Dashboard-Refresh.zip is merged into
AdminDashboard.css. AdminDashboard.jsx continues to import that stylesheet;
no additional CSS import or dashboard component is required.

This is a visual-only layer. It does not alter API calls, authentication,
Supabase logic, component state, event handlers, or existing dashboard features.

GitHub rejected direct writes with a 403 permission error. Nothing was pushed.
The ZIP contains the stylesheet and exact import patch, not a full copy of the
existing large JSX file.
