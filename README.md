# Timekeep — Timesheet App

Mobile-optimized timesheet system with employer and employee portals: assignable project codes with validity windows, semi-monthly timesheet submission/approval with a required affidavit and a justified-change audit log, employer-entered timesheets with employee acknowledgment, start-date-aware automatic PTO accrual, real employee offboarding, self-service password reset, email notifications, and reporting.

## Stack (fully free, no server to maintain)

| Piece | Service | What it does |
|---|---|---|
| Frontend | React + Vite, hosted on **Netlify** | The actual website people use |
| Backend/DB | **Supabase** (Postgres) | Database, authentication, row-level security |
| Edge Functions | Supabase (Deno) | Admin actions (create/offboard employees) + all email notifications — service-role key never touches the browser |
| Email | **Resend** (verified domain), called directly from Edge Functions | Employee invites/password resets (via Supabase Auth SMTP) + submission/approval/rejection/acknowledgment notifications (via Resend's API directly) |
| Code hosting | **GitHub** — `github.com/ali-kareemnetworks/timesheet` | Source of truth; pushes here auto-deploy to Netlify |
| Logo storage | Supabase **Storage** (public `branding` bucket) | Company logo on sign-in page and app shell |

## Key locations

- **GitHub repo:** https://github.com/ali-kareemnetworks/timesheet
- **Supabase project ref:** `ueakikmyytozesgesjcs`
- **Netlify team:** `aibrahim9386`

---

## Edge Functions (all in `supabase/functions/`)

| Function | Trigger | Does |
|---|---|---|
| `create-employee` | Employer adds an employee | Creates the auth user, sends invite email, creates profile, auto-assigns HOLIDAY/VACATION codes |
| `offboard-employee` | Employer offboards/reactivates | Bans/unbans the auth account (real access revocation, not just a flag), stamps `offboarded_at` |
| `notify-employer-submission` | Employee submits a timesheet | Emails every employer account, subject line includes employee name + period, with a link to Review |
| `notify-employee-rejection` | Employer rejects a timesheet | Emails the employee the correction reason |
| `notify-employee-approval` | Employer approves a timesheet | Emails the employee a confirmation |
| `notify-employee-acknowledgment` | Employer sends an employer-entered timesheet for review | Emails the employee asking them to review and confirm it |

The `notify-*` functions share these **project-level Edge Function secrets** (Supabase dashboard → Edge Functions → Secrets):
- `RESEND_API_KEY` — from Resend dashboard → API Keys
- `RESEND_FROM_EMAIL` — e.g. `Timekeep <noreply@yourdomain.com>`, must be on your verified Resend domain
- `APP_URL` — your live site, e.g. `https://your-site.netlify.app` (optional — emails just omit the link without it)

`create-employee` and `offboard-employee` don't need these — they use the auto-injected `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` only.

**Note:** rejection notifications originally used EmailJS (client-side). That's fully replaced by `notify-employee-rejection` — the `VITE_EMAILJS_*` env vars are no longer used anywhere and are safe to remove.

---

## Setting up from scratch (new environment)

1. Create a Supabase project. Run `supabase/schema.sql` in SQL Editor — reflects current app state end-to-end, so a fresh install doesn't need the individual dated migration files below.
2. Copy `.env.example` to `.env`, fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
3. Deploy all six Edge Functions listed above (Edge Functions → Deploy a new function → Via Editor → paste the matching `index.ts` → name it **exactly** as shown in the table).
4. Set the three Resend secrets (see above).
5. Create your first employer login (Authentication → Users → Add user, then link via SQL — see comment at the bottom of `schema.sql`).
6. Set Authentication → URL Configuration → Site URL to your live site URL.
7. Set up custom SMTP (Resend) under Authentication → Emails → SMTP Settings — needed for Supabase's own invite/password-reset emails (separate from the Resend API calls the Edge Functions make directly).
8. `npm install`, `npm run build`, deploy to Netlify (or connect the GitHub repo for auto-deploy). Set the same env vars in Netlify's Site Configuration, plus the Resend secrets in Supabase.

## If you're restoring an existing database instead

Run these in order (all still in `supabase/`, kept for reference — a fresh install can skip to `schema.sql` instead):

1. `migration-semimonthly.sql` — weekly → semi-monthly periods
2. `migration-branding.sql` — logo storage + `company_settings`
3. `pto-accrual-migration.sql` — automatic per-period PTO accrual
4. `pto-usage-by-day-migration.sql` — PTO usage logged per actual day taken
5. `migration-code-assignments.sql` — assignable project codes per employee
6. `migration-start-date.sql` — adds employee `start_date`
7. `migration-pto-start-date-proration.sql` — ties PTO accrual to start date
8. `migration-timesheet-adjustments.sql` — audit log for justified hour changes
9. `migration-offboarding.sql` — adds `offboarded_at` for real offboarding
10. `migration-certification.sql` — adds submission affidavit fields
11. `migration-code-validity.sql` — project code valid-from/valid-until windows with enforcement
12. `migration-employer-entry.sql` — employer-entered timesheets + employee acknowledgment status

**Important:** after adding any new migration file, run it in SQL Editor *before* testing the matching feature. Several sessions have hit "Could not find the 'x' column... in the schema cache" purely because a migration was written but not yet run — that error always means exactly that. Quick way to check if a specific migration ran:
```sql
select column_name from information_schema.columns
where table_name = 'TABLE_NAME' and column_name = 'COLUMN_NAME';
```
Empty result = migration hasn't been run yet.

---

## Features

| Requirement | Where / how |
|---|---|
| Employer / employee portals | Role-based routing — one login, app shows the right portal automatically |
| Project codes (customer, contract/task, labor category) | Employer → **Project Codes** |
| Codes assignable per employee | Employer → **Project Codes** → "Assign employees" per code. HOLIDAY/VACATION are automatic for everyone; everything else needs explicit assignment |
| Code validity windows | Employer → **Project Codes** → optional Valid from/until dates per code. Employee timesheet cells outside the window are disabled; a database trigger blocks it even if bypassed client-side |
| Semi-monthly timesheets (1st–15th, 16th–end) | Employee → **Timesheet**, prev/next period navigation |
| Submission affidavit | Employee must check a certification statement before Submit is enabled; wording, employee, and timestamp are permanently recorded and visible to the employer on Review |
| Approve / reject with correction notice + email | Employer → **Review**; employee sees reason in-app + gets an email either way; approval also emails a confirmation |
| Justified changes + audit log | Changing an already-saved hour value requires a written justification (with bulk-apply across days); permanently logged and viewable in employee **History** and employer **Review** |
| Employer-entered timesheets | Employer → **Enter Timesheet** — pick an employee/period, enter hours, send for the employee's review. Employee must review, correct if needed, and check the certification box themselves before it enters the normal approval queue |
| Editing an already-approved timesheet | Same **Enter Timesheet** page — saving changes reopens it (back to pending employee review, certification cleared) and automatically reverses/reposts its PTO via the existing trigger |
| Reports on approved timesheets | Employer → **Reports**, filter by date/employee (includes offboarded employees), CSV export |
| Add / offboard employees | Employer → **Employees**. Offboarding actually revokes login (bans the Supabase Auth account, not a cosmetic flag) while keeping all historical data intact — true deletion is avoided since `ON DELETE CASCADE` would wipe out their timesheet/PTO history |
| Employee start date | Set on creation, editable afterward with a confirmation warning if it conflicts with existing timesheets |
| Yearly vacation allotment + start-date-aware accrual | Employer sets the allotment; accrual is automatic on approval, zero before the start date, prorated for the period they start in, full afterward |
| Negative-balance PTO submission | Employees can submit VACATION hours even with a negative balance |
| PTO usage tracked by actual day taken | One usage ledger entry per calendar day taken, not per period |
| Self-service password reset | Login page → "Forgot password?" sends a reset email; logged-in users can also change their password anytime under **Account** |
| Company logo | Employer → **Branding** |

## Design notes

- **Fonts:** Headers use **Plus Jakarta Sans**, body uses **Inter**. Numbers/codes use Inter with tabular figures — no literal monospace font.
- **PTO ledger entry types:** `accrual` (automatic, per approved period, start-date-aware), `usage` (automatic, per day of VACATION taken), `allotment` (manual grants). Displayed balances are rounded to 2 decimals for display only (underlying numbers are exact).
- **Timesheet statuses:** `draft` → `pending_acknowledgment` (only when employer-entered or reopened) → `submitted` → `approved` / `rejected`. Employees can edit during `draft`, `rejected`, and `pending_acknowledgment`.
- **Security:** Postgres row-level security throughout — employees only see their own data; only employer-role accounts see everyone's. All admin-privileged actions (creating/offboarding employees, cross-user emails, reading another user's profile for notifications) go through Edge Functions using the service-role key server-side, never in the browser.

## Making changes going forward

1. Edit files locally, test, `git add .` → `git commit` → `git push`. Netlify auto-deploys.
2. Database changes: write a new `supabase/migration-*.sql` file, **run it in SQL Editor immediately**, and update `supabase/schema.sql` so a fresh install stays in sync.
3. New Edge Functions: create under `supabase/functions/<name>/index.ts`, deploy via dashboard, name must match exactly what the app calls via `supabase.functions.invoke(...)`.
4. Updating an existing Edge Function: Supabase dashboard → Edge Functions → [name] → edit → replace contents → Deploy. No git/code changes needed for function-only fixes.

## Known gotchas (reference)

- **"Could not find the 'x' column... in the schema cache"** — the migration adding that column hasn't been run yet. This has come up repeatedly; always run a new migration before testing its feature.
- **Generated columns + `date_trunc`:** can throw "generation expression is not immutable" from ambiguous overload resolution. Use `make_date(...)` instead.
- **Supabase's default email sender** only reaches org team members and is rate-limited — custom SMTP (Resend) is required for real invite/reset emails.
- **Resend's sandbox address** (`onboarding@resend.dev`) only sends to your own account until a domain is verified.
- **Invite/recovery links** land with `#...&type=invite` in the URL; Supabase's client auto-strips it, which can race the app's own check — fixed by capturing it once via a `useState` lazy initializer on mount.
- **`.env` vs Netlify env vars are separate** — both need the same values set independently.
- **JS floating-point display:** summing decimals (e.g. `4.67 + 4.67 - 16`) can show as `-1.9899999999999984`. Fixed with `.toFixed(2)` at display time only.
- **Edge Function "Failed to send a request"** vs **"returned a non-2xx status code"** are different errors: the first means the function couldn't be reached at all (not deployed, or a name mismatch — check the Edge Functions list and Logs); the second means it ran and returned an error (check the response body / function Logs for the actual message).
- **Fetching another user's data inside an Edge Function** should use the admin (service-role) client, not the caller's own token — relying on the caller's RLS permissions for this is fragile (this caused a "self-lookup" bug where an employee's own name silently failed to resolve in a notification email).
- **EmailJS was dropped** for rejection notifications in favor of Resend-via-Edge-Function — more reliable, no separate browser-side config to maintain.
- **Stale login sessions** — since this project gets tested by switching between employer/employee accounts in the same browser, an unexpected "Only employers can..." error is often just a stale session; sign out and back in with the correct account first.

## Not yet done / optional

- Custom domain for the Netlify site
- A HostGator/PHP+MySQL version was considered early on but not built, since this free Supabase/Netlify stack was chosen instead
- A consolidated "check all expected columns exist" diagnostic script, to catch un-run migrations in one pass instead of one-at-a-time
