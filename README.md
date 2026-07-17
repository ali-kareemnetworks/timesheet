# Timekeep — Timesheet App

Mobile-optimized timesheet system with employer and employee portals.
Stack: **React + Vite** (frontend) · **Supabase** (Postgres DB, auth, security) · **Netlify** (free hosting) · **EmailJS** (optional rejection emails). No server to maintain.

---

## 1. Create your Supabase project (free)

1. Go to https://supabase.com → **New project**. Pick any name/region, save the database password somewhere safe.
2. Once it's created, open **SQL Editor → New query**, paste in the entire contents of `supabase/schema.sql` from this project, and click **Run**. This creates all tables, security rules, and seeds the `HOLIDAY`, `VACATION`, and `CLIENT_SITE` project codes.
3. Go to **Project Settings → API**. Copy the **Project URL** and the **anon public** key — you'll need them next.

## 2. Configure the app

1. In this project folder, copy `.env.example` to `.env`.
2. Fill in:
   ```
   VITE_SUPABASE_URL=...       (Project URL from step 1.3)
   VITE_SUPABASE_ANON_KEY=...  (anon public key from step 1.3)
   ```
3. Leave the `VITE_EMAILJS_*` values blank for now — see the optional email step near the end if you want that later.

## 3. Deploy the "add employee" function

Adding an employee needs a small secure server-side function (so we never expose an admin key in the browser). Supabase runs this for free, and you can deploy it right from their website — no command line needed.

1. In the Supabase dashboard, click **Edge Functions** in the left sidebar.
2. Click **Deploy a new function** → **Via Editor**.
3. Delete the placeholder code, then copy the full contents of `supabase/functions/create-employee/index.ts` from this project and paste it in.
4. Name the function exactly `create-employee`.
5. Click **Deploy**.

Supabase automatically gives the function the project keys it needs — nothing else to configure.

*(Prefer the command line? You can also run `npm install -g supabase`, `supabase login`, `supabase link --project-ref YOUR-PROJECT-REF`, then `supabase functions deploy create-employee`.)*

## 4. Create your first employer login

1. In the Supabase dashboard: **Authentication → Users → Add user**. Enter your own email and a password, and check "Auto-confirm user".
2. Back in **SQL Editor**, run (replace the email):
   ```sql
   insert into public.profiles (id, role, full_name, email, yearly_vacation_hours)
   select id, 'employer', 'Your Name', email, 0 from auth.users where email = 'you@example.com';
   ```
3. You can now log into the app with that email/password and you'll land on the employer portal.

## 5. Run it locally (optional, to test first)

```bash
npm install
npm run dev
```

## 6. Deploy the site for free on Netlify

**Easiest way — drag & drop:**
```bash
npm install
npm run build
```
Go to https://app.netlify.com/drop and drag the generated `dist` folder onto the page. Done — you'll get a live `https://your-site.netlify.app` URL immediately.

**Better way — connect to Git (auto-deploys on every change):**
1. Push this project to a GitHub repo.
2. In Netlify: **Add new site → Import an existing project** → pick the repo.
3. Build command: `npm run build`  ·  Publish directory: `dist`
4. Under **Site settings → Environment variables**, add the same `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and (optionally) the `VITE_EMAILJS_*` values from your `.env`.
5. Deploy. Netlify gives you free HTTPS and you can attach your own domain later under **Domain settings** at no extra cost.

**Note your live URL** (e.g. `https://your-site.netlify.app`) — you need it for the next step.

## 7. Point Supabase at your real site (required before inviting employees)

By default, Supabase sends invite/password-reset emails with links back to `localhost:3000`, which only works on your own dev machine. Now that you have a live URL from step 6, fix this **before** adding any employees:

1. In the Supabase dashboard: **Authentication → URL Configuration**.
2. Set **Site URL** to your live site, e.g. `https://your-site.netlify.app`.
3. Under **Redirect URLs**, add that same URL (and `http://localhost:5173` too if you also want invite links to work while testing locally).
4. Save.

If you already sent an employee invite before doing this, that link is dead. Fix it: delete that user in **Authentication → Users**, then in **SQL Editor** run `delete from public.profiles where email = '...';`, then re-add them from the Employees page in the app to send a fresh, working invite.

## 8. (Optional) Email notifications for rejected timesheets

Without this, employees still see a clear "sent back for correction" banner with the reason the moment they open the app — so this step is optional.

1. Sign up free at https://www.emailjs.com
2. Add an **Email Service** (e.g. connect your Gmail).
3. Create an **Email Template** using these variables: `{{to_email}}`, `{{to_name}}`, `{{week_start}}`, `{{reason}}`.
4. Copy your Service ID, Template ID, and Public Key into `.env` (and into Netlify's environment variables if you deployed via Git — then redeploy):
   ```
   VITE_EMAILJS_SERVICE_ID=...
   VITE_EMAILJS_TEMPLATE_ID=...
   VITE_EMAILJS_PUBLIC_KEY=...
   ```

---

## How the features map to the app

| Requirement | Where |
|---|---|
| Employer / employee portals | Role-based routing — one login, app shows the right portal automatically |
| Project codes (customer, contract/task, labor category) | Employer → **Project Codes** |
| Approve / reject with correction notice | Employer → **Review**; employee sees reason on **My Week** + gets an email if configured |
| Reports on approved timesheets | Employer → **Reports**, with CSV export |
| Add employees (name, email, phone, address, position) | Employer → **Employees** — sends the employee an email invite to set their own password |
| Yearly vacation allotment + negative-balance PTO submission | Employer → **Employees** (set allotment / grant hours); Employee → **PTO** (see running balance, can go negative) |
| HOLIDAY, VACATION, CLIENT_SITE codes | Seeded automatically by `schema.sql`; employer can add more anytime |
| Running PTO balance as timesheets are processed | Approving a timesheet with VACATION hours automatically posts usage to the PTO ledger (see `post_vacation_usage` trigger in `schema.sql`) |

## Notes

- All data access is enforced by Postgres row-level security — employees can only ever see their own data; only employer accounts can see everyone's.
- Everything scales down to a single phone screen (bottom tab bar) and up to a desktop sidebar automatically.
- This project has **no HostGator/PHP dependency** — it was built on a fully free stack per your request. If you'd still like a HostGator/PHP+MySQL version instead, let me know and I'll build that variant.
