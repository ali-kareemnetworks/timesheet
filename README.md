# Timekeep — Timesheet App

Mobile-optimized timesheet system with employer and employee portals: project codes, semi-monthly timesheet submission/approval, automatic PTO accrual and tracking, and reporting.

## Stack (fully free, no server to maintain)

| Piece | Service | What it does |
|---|---|---|
| Frontend | React + Vite, hosted on **Netlify** | The actual website people use |
| Backend/DB | **Supabase** (Postgres) | Database, authentication, row-level security |
| Employee account creation | Supabase **Edge Function** (`create-employee`) | Runs server-side so the admin key never touches the browser |
| Invite/notification emails | Supabase Auth emails, sent via **Resend** (custom SMTP, verified domain) | Employee invites + rejected-timesheet notices |
| Code hosting | **GitHub** — `github.com/ali-kareemnetworks/timesheet` | Source of truth; pushes here auto-deploy to Netlify |
| Logo storage | Supabase **Storage** (public `branding` bucket) | Company logo shown on sign-in page and app shell |

## Key locations

- **GitHub repo:** https://github.com/ali-kareemnetworks/timesheet
- **Supabase project ref:** `ueakikmyytozesgesjcs`
- **Netlify team:** `aibrahim9386`
- **Email sending:** Resend, verified domain (not the `onboarding@resend.dev` sandbox — that only sends to your own account)

---

## Setting up from scratch (new environment)

1. Create a Supabase project. In **SQL Editor**, run `supabase/schema.sql` — this reflects the *current* state of the app (semi-monthly periods, PTO accrual, branding table all included), so a fresh install doesn't need the individual migration files below.
2. Copy `.env.example` to `.env`, fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from Supabase → Project Settings → API.
3. Deploy the `create-employee` Edge Function (Supabase dashboard → Edge Functions → Deploy a new function → Via Editor → paste `supabase/functions/create-employee/index.ts` → name it exactly `create-employee`).
4. Create your first employer login (Authentication → Users → Add user, then link it via SQL — see comment at the bottom of `schema.sql`).
5. Set Authentication → URL Configuration → Site URL to your live site URL (needed before inviting employees, or invite links point to `localhost`).
6. Set up custom SMTP (Resend) under Authentication → Emails → SMTP Settings — Supabase's default sender only reaches your own org's team and is rate-limited, so this is required for real employee invites.
7. `npm install`, `npm run build`, deploy `dist/` to Netlify (or connect the GitHub repo directly for auto-deploy on push). Set the same env vars in Netlify's Site Configuration.

## If you're restoring an existing database instead

Run these migration files **in this order** against your existing Supabase project (they're all still in `supabase/`, kept for reference/history — a brand-new install can skip straight to `schema.sql` instead, since it already reflects the end state):

1. `migration-semimonthly.sql` — converts weekly timesheets to semi-monthly periods (1st–15th, 16th–end of month)
2. `migration-branding.sql` — adds the logo storage bucket + `company_settings` table
3. `pto-accrual-migration.sql` — adds automatic per-period PTO accrual (`yearly_vacation_hours ÷ 24`) and backfills it for already-approved timesheets
4. `pto-usage-by-day-migration.sql` — changes PTO usage from one lump entry per pay period to one entry per actual calendar day taken, and rebuilds existing usage history to match

---

## How the features map to the app

| Requirement | Where |
|---|---|
| Employer / employee portals | Role-based routing — one login, app shows the right portal automatically |
| Project codes (customer, contract/task, labor category) | Employer → **Project Codes** |
| Semi-monthly timesheets (1st–15th, 16th–end) | Employee → **Timesheet**, with prev/next period navigation |
| Approve / reject with correction notice | Employer → **Review**; employee sees reason on **Timesheet** + gets an email if configured |
| Reports on approved timesheets | Employer → **Reports**, filter by date/employee, CSV export |
| Add employees (name, email, phone, address, position) | Employer → **Employees** — sends an email invite to set their own password |
| Yearly vacation allotment | Employer → **Employees**, editable per person |
| Automatic PTO accrual | Approving any timesheet posts `yearly_vacation_hours ÷ 24` to that employee's PTO ledger for that period, regardless of whether they used PTO that period |
| PTO usage tracked by actual day taken | Approving a timesheet with VACATION hours posts one usage entry per calendar day taken (not one lump entry per period) |
| Negative-balance PTO submission | Employees can submit VACATION hours even with a negative balance — nothing blocks it |
| HOLIDAY, VACATION, CLIENT_SITE codes | Seeded automatically; employer can add more anytime |
| Company logo | Employer → **Branding** — shows on the sign-in page and top-left of the app shell once uploaded |

## Design notes

- **Fonts:** Headers use **Plus Jakarta Sans**, body text uses **Inter**. Numbers/codes (hours grid, project codes, status badges) use Inter with tabular figures for alignment — no literal monospace/typewriter font.
- **PTO ledger:** every entry has a type — `accrual` (automatic, per approved period), `usage` (automatic, per day of VACATION taken), or `allotment` (manual grants posted by the employer). The employee's **PTO** page and the employer's **Employees** list both show the running balance rounded to 2 decimal places for display (the underlying numbers are exact; this only affects what's shown on screen).
- **Security:** Postgres row-level security — employees only ever see their own data; only employer-role accounts see everyone's.

## Making changes going forward

1. Edit files locally.
2. `git add .` → `git commit -m "..."` → `git push`
3. Netlify auto-builds and deploys — check the **Deploys** tab.
4. If a change touches the database, write it as a new `supabase/migration-*.sql` file, run it in the Supabase SQL Editor, and also update `supabase/schema.sql` so a fresh install stays in sync with production.

## Known gotchas (reference)

- **Generated columns + `date_trunc`:** Postgres can reject `date_trunc` inside a `generated ... stored` column with "generation expression is not immutable" because of ambiguous timestamp/timestamptz overload resolution. Use `make_date(...)` instead, which has no such ambiguity.
- **Supabase's default email sender** only delivers to your org's team members and is capped at a few emails/hour — this is why custom SMTP (Resend) is required for real employee invites.
- **Resend's sandbox address** (`onboarding@resend.dev`) can only send to your own verified Resend account email until a real domain is verified — verify a domain before relying on invites reaching employees.
- **Invite/recovery links** land with `#...&type=invite` in the URL. Supabase's client auto-consumes and strips that hash on load, which can race against the app's own check for it — the fix is capturing the flag once via a `useState` lazy initializer on mount, not re-reading `window.location.hash` on every render.
- **`.env` is separate from Netlify's environment variables.** Local `.env` only affects `npm run build`/`npm run dev` on your machine; Netlify needs the same values set independently under Site Configuration → Environment Variables when it's building from GitHub.
- **JS floating-point display:** summing decimal numbers in JavaScript (e.g. `4.67 + 4.67 - 16`) can produce long imprecise decimals like `-1.9899999999999984`. Fixed by rounding with `.toFixed(2)` at display time — the stored data itself is exact.

## Not yet done / optional

- Custom domain for the Netlify site
- EmailJS is wired in as a secondary rejection-notification channel but isn't required (Resend/Supabase handles invite emails); leave `VITE_EMAILJS_*` blank unless wanted
- A HostGator/PHP+MySQL version was discussed early on but not built, since this free Supabase/Netlify stack was chosen instead
