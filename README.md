# Timekeep — Timesheet App

Mobile-optimized timesheet system with employer and employee portals: assignable project codes, semi-monthly timesheet submission/approval with justified-change audit logging, automatic start-date-aware PTO accrual, employee offboarding, email notifications, and reporting.

## Stack (fully free, no server to maintain)

| Piece | Service | What it does |
|---|---|---|
| Frontend | React + Vite, hosted on **Netlify** | The actual website people use |
| Backend/DB | **Supabase** (Postgres) | Database, authentication, row-level security |
| Edge Functions | Supabase (Deno) | Admin actions (create/offboard employees) + all email notifications — service-role key never touches the browser |
| Email | **Resend** (verified domain), called directly from Edge Functions | Employee invites/password resets (via Supabase Auth SMTP) + submission/approval/rejection notifications (via Resend's API directly) |
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
| `notify-employer-submission` | Employee submits a timesheet | Emails every employer account, with a link to Review |
| `notify-employee-rejection` | Employer rejects a timesheet | Emails the employee the correction reason |
| `notify-employee-approval` | Employer approves a timesheet | Emails the employee a confirmation |

The three `notify-*` functions share these **project-level Edge Function secrets** (Supabase dashboard → Edge Functions → Secrets):
- `RESEND_API_KEY` — from Resend dashboard → API Keys
- `RESEND_FROM_EMAIL` — e.g. `Timekeep <noreply@yourdomain.com>`, must be on your verified Resend domain
- `APP_URL` — your live site, e.g. `https://your-site.netlify.app` (optional — emails just omit the link without it)

`create-employee` and `offboard-employee` don't need these — they use the auto-injected `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` only.

**Note:** rejection notifications originally used EmailJS (client-side). That's been fully replaced by `notify-employee-rejection` — the `VITE_EMAILJS_*` env vars are no longer used anywhere and are safe to remove.

---

## Setting up from scratch (new environment)

1. Create a Supabase project. Run `supabase/schema.sql` in SQL Editor — reflects current app state end-to-end, so a fresh install doesn't need the individual dated migration files below.
2. Copy `.env.example` to `.env`, fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
3. Deploy all five Edge Functions listed above (Edge Functions → Deploy a new function → Via Editor → paste the matching `index.ts` → name it **exactly** as shown in the table).
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

---

## What was added today

- **Assignable project codes:** employer assigns which employees can use which project codes (Project Codes page, per-code checkboxes). HOLIDAY and VACATION are automatic for everyone; everything else needs explicit assignment. Employees only see codes they've been assigned on their Timesheet page.
- **Employee start date:** settable when creating an employee, editable afterward — but editing now **warns before applying** if the employee already has submitted timesheets, with a stronger warning if the change would contradict an existing timesheet's dates.
- **PTO tied to start date:** periods entirely before an employee's start date accrue nothing; the period they start in accrues a prorated share based on days actually employed that period; full accrual applies to every period after. Employees with no start date set are unaffected (treated as always employed, unchanged behavior).
- **Justified timesheet changes + audit log:** changing an already-saved hour value (not a first-time entry) requires a written justification before saving/submitting, with a "use for all days" bulk-apply option. Every change is permanently logged (insert-only, no edit/delete) and viewable in both the employee's History page and the employer's Review page.
- **Real employee offboarding:** "Offboard" actually revokes login access (bans the Supabase Auth account, not just a cosmetic flag — this was a real gap in the old "Deactivate" button, now fixed). All historical timesheets, PTO, and reports remain fully intact and queryable. Offboarded employees are shown separately, read-only, with a Reactivate option. True SQL deletion was intentionally avoided — `ON DELETE CASCADE` on the schema means a hard delete would wipe out their timesheet/PTO history, which is exactly what needs to be preserved.
- **Email notifications for the full approval lifecycle:** employee submits → employer emailed; employer rejects → employee emailed with the reason; employer approves → employee emailed confirmation. All three via dedicated Edge Functions calling Resend directly (more reliable than the EmailJS approach originally used for rejections).

## How the features map to the app

| Requirement | Where |
|---|---|
| Employer / employee portals | Role-based routing — one login, app shows the right portal automatically |
| Project codes (customer, contract/task, labor category) | Employer → **Project Codes** |
| Codes assignable per employee | Employer → **Project Codes** → "Assign employees" per code |
| Semi-monthly timesheets (1st–15th, 16th–end) | Employee → **Timesheet**, prev/next period navigation |
| Approve / reject with correction notice + email | Employer → **Review**; employee sees reason in-app + gets an email either way |
| Justified changes + audit log | Employee → **Timesheet** (editing) and **History**; Employer → **Review** (expanded view) |
| Reports on approved timesheets | Employer → **Reports**, filter by date/employee (includes offboarded employees), CSV export |
| Add / offboard employees | Employer → **Employees** |
| Employee start date | Set on creation, editable with confirmation afterward |
| Yearly vacation allotment + start-date-aware accrual | Employer → **Employees** (set allotment); accrual automatic on approval, prorated around start date |
| Negative-balance PTO submission | Employees can submit VACATION hours even with a negative balance |
| PTO usage tracked by actual day taken | One usage ledger entry per calendar day taken, not per period |
| HOLIDAY, VACATION, CLIENT_SITE codes | Seeded automatically; HOLIDAY/VACATION auto-assigned to every employee |
| Company logo | Employer → **Branding** |

## Design notes

- **Fonts:** Headers use **Plus Jakarta Sans**, body uses **Inter**. Numbers/codes use Inter with tabular figures — no literal monospace font.
- **PTO ledger entry types:** `accrual` (automatic, per approved period, start-date-aware), `usage` (automatic, per day of VACATION taken), `allotment` (manual grants). Displayed balances are rounded to 2 decimals (underlying numbers are exact — this is a JS floating-point display fix only).
- **Security:** Postgres row-level security throughout — employees only see their own data; only employer-role accounts see everyone's. All admin-privileged actions (creating/offboarding employees, cross-user emails) go through Edge Functions using the service-role key server-side, never in the browser.

## Making changes going forward

1. Edit files locally, test, `git add .` → `git commit` → `git push`. Netlify auto-deploys.
2. Database changes: write a new `supabase/migration-*.sql` file, run it in SQL Editor, and update `supabase/schema.sql` so a fresh install stays in sync.
3. New Edge Functions: create under `supabase/functions/<name>/index.ts`, deploy via dashboard, name must match exactly what the app calls via `supabase.functions.invoke(...)`.

## Known gotchas (reference)

- **Generated columns + `date_trunc`:** can throw "generation expression is not immutable" from ambiguous overload resolution. Use `make_date(...)` instead.
- **Supabase's default email sender** only reaches org team members and is rate-limited — custom SMTP (Resend) is required for real invite/reset emails.
- **Resend's sandbox address** (`onboarding@resend.dev`) only sends to your own account until a domain is verified.
- **Invite/recovery links** land with `#...&type=invite` in the URL; Supabase's client auto-strips it, which can race the app's own check — fixed by capturing it once via a `useState` lazy initializer on mount.
- **`.env` vs Netlify env vars are separate** — both need the same values set independently.
- **JS floating-point display:** summing decimals (e.g. `4.67 + 4.67 - 16`) can show as `-1.9899999999999984`. Fixed with `.toFixed(2)` at display time only.
- **Edge Function 404/CORS errors** almost always mean the function name doesn't match exactly what's deployed, or it was never actually deployed — check Edge Functions → [name] → Logs, and the browser Network tab's preflight request status.
- **EmailJS was dropped** for rejection notifications in favor of Resend-via-Edge-Function — more reliable, no separate browser-side config to maintain.

## Not yet done / optional

- Custom domain for the Netlify site
- A HostGator/PHP+MySQL version was considered early on but not built, since this free Supabase/Netlify stack was chosen instead
- Blocking/hiding timesheet periods before an employee's start date (currently only PTO accrual respects the start date — nothing stops submitting a timesheet for an earlier period)
