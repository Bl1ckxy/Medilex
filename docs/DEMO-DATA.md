# MediLex demo & mock data

What you see when you open <https://medilex-eight.vercel.app>, where it comes from,
and how to extend it. Every figure below comes from a read-only inventory taken on
**2026-10-15** (`/rest/v1` with the service-role key) or from a rendered screenshot —
the numbers drift as the e2e suite runs.

## Demo account

| Field | Value |
| --- | --- |
| Email | `test-e2e@example.com` |
| Password | `TestPass123!` |

This is the account the Playwright suite logs into. It stays populated because the
suite creates cases, uploads evidence and runs analyses against production.

## Inventory (read-only, 2026-10-15)

| Table | Count | Notes |
| --- | --- | --- |
| `users` | 5 | All `role = associate`, all `is_active = true` |
| `cases` | 61 | 51 `intake`, 10 `analysis`; numbers `NS/2026/0001`–`NS/2026/0064` |
| `documents` | 10 | Evidence uploads produced by the e2e upload test |
| `ai_analyses` | 27 | 15 `case_strength`, 12 `compensation_estimate` |
| `legal_chunks` | 62 | Seeded via `npm run seed:legal:prod` |

- The demo session (`test-e2e@example.com`) can see **20** of the 61 cases (RLS:
  creator/assignee or firm admin); the dashboard stat cards read 8 active matters and
  ₹4,00,00,000 claim value for that view.
- All e2e-created cases share the same fixture facts (Rahul Deshmukh · Apollo Hospital ·
  ₹50,00,000 · delayed treatment) — automation output, not editorial content.
- **No `firm_admin` exists yet**, so the Admin nav link and `/dashboard/admin` are
  hidden/locked until you promote an account (see Admin panel below).
- The five accounts: `rcdxxbl3de@gmail.com`, `test-e2e@example.com`,
  `admin-debug-1791986507919@example.com` (debug leftover), `chettiyary@gmail.com`,
  `fetchharsh888@gmail.com`.

## Landing page (`/`) is static

The public landing page ("Case portfolio", 24 active cases, 186 documents, 8 team
members, 18/22/30 Sep deadlines, Ananya Sharma / Ramesh Kumar / Meera Iyer rows) is
**hard-coded marketing copy** in `src/app/page.tsx`. It is not a database read and does
not change when cases are created or deleted.

## What works out of the box (verified 2026-10-15)

- **Cases**: list → open any matter (e.g. `NS/2026/0064`) → all five tabs
  (Overview · Evidence · Analysis · Counsel review · ODR & filing) render and switch.
- **Legal research** (`/dashboard/legal`): `Ask` (LLM, Groq → Gemini fallback) and
  `Search only (no AI)` against the 62-chunk corpus.
- **Analysis**: `Run assessment` and `Estimate compensation` on the Analysis tab.
- **Evidence**: upload a PDF and OCR proceeds asynchronously (`documents.ocr_status`).
- **Responsiveness**: audited at 375 / 768 / 1280 px by
  `tests/e2e/responsive.spec.ts` — 42 page-and-tab checks, zero horizontal overflow.

## Recipes

### Create a case (UI or API)

UI: dashboard → `Open a case` / Cases → `New case`.

API (the same payload the e2e suite POSTs as the logged-in user):

```json
POST /api/cases
{
  "patientName": "Rahul Deshmukh",
  "patientAge": 45,
  "patientGender": "male",
  "nextOfKin": "Priya Deshmukh",
  "nextOfKinRelation": "Wife",
  "hospitalName": "Apollo Hospital",
  "hospitalType": "private",
  "hospitalCity": "Mumbai",
  "hospitalState": "Maharashtra",
  "negligenceType": "delayed_treatment",
  "severity": "permanent_disability",
  "incidentDate": "2024-01-15T10:00:00.000Z",
  "incidentDescription": "Patient admitted with chest pain. Delayed ECG and troponin testing by 6 hours. Resulted in missed STEMI diagnosis and permanent cardiac damage.",
  "claimAmount": 5000000,
  "treatingDoctorName": "Dr. A. Kumar",
  "treatingDoctorRegistration": "MMC-12345"
}
```

### Add an evidence document

Evidence vault → upload, or copy `tests/fixtures/test-document.pdf` through the e2e
upload flow. Row lands in `documents` with `ocr_status = pending` → `completed`.

### Run analyses

Case → Analysis tab → `Run assessment` / `Estimate compensation`. Results append to
`ai_analyses` and update the case's cached score.

### Enable the admin panel

1. Run `supabase/admin-panel.sql` in the Supabase SQL Editor (idempotent lockout
   guards; no schema change — the panel uses the existing `users.role` enum and
   `users.is_active`).
2. Promote yourself (one row, reversible):

   ```sql
   UPDATE users SET role = 'firm_admin' WHERE email = 'you@example.com';
   ```

3. Sign out and back in. The `Admin` nav link and `/dashboard/admin` appear
   (middleware + page + nav are all gated on `role = 'firm_admin'`).

### Seed / re-seed the legal corpus

```bash
npm run seed:legal:prod
```

Service-role writes by design (no INSERT policy on `legal_chunks`).

## Housekeeping notes

- `admin-debug-1791986507919@example.com` is a leftover debug account; delete it in
  the Supabase dashboard if unwanted — there is intentionally **no delete UI**
  (chain of custody: deletion is disabled in the app and denied by RLS).
- Do not edit eval questions or thresholds (`docs/legal-qa-eval.md`); eval results go to
  `docs/eval-results.md` only from a clean full run.
