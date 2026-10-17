# MediLex demo data

The public landing dashboard at `/` is intentionally usable without an account. It
uses [`src/mockDashboardData.ts`](../src/mockDashboardData.ts) for the cases and
deadlines shown in the demo.

## What the demo supports

- Search across client, matter, case number, status, hospital, and case type.
- Create a new case from the **New case** dialog. New cases are kept in browser
  memory for the current session and appear in search and the recent-cases table.
- Open a case row to inspect its mock details.
- Use the sidebar to jump between the overview, recent cases, deadlines, and
  analysis queue sections.
- Use the header controls for dark mode, help, notifications, and the profile
  menu.

This data is fictional and is not connected to the production case database.
