-- =====================================================================
-- TIMESHEET APP — SUPABASE SCHEMA
-- Run this entire file once in Supabase: Dashboard -> SQL Editor -> New query
-- =====================================================================

-- ---------- PROFILES (one row per user, linked to Supabase Auth) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('employer','employee')),
  full_name text not null,
  email text not null,
  phone text,
  home_address text,
  position text,
  yearly_vacation_hours numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- PROJECT CODES ----------
create table public.project_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_name text,        -- name of the government customer
  contract_task text,        -- contract / task order number
  labor_category text,       -- labor category
  code_type text not null default 'CLIENT_SITE'
    check (code_type in ('CLIENT_SITE','HOLIDAY','VACATION','INTERNAL','OTHER')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- TIMESHEETS (one per employee per semi-monthly period) ----------
-- Periods always run 1st-15th, or 16th-end of month.
create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  period_start_date date not null,     -- always the 1st or the 16th of a month
  period_end_date date generated always as (
    case
      when extract(day from period_start_date)::int = 1
        then (period_start_date + 14)::date
      else
        (make_date(extract(year from period_start_date)::int, extract(month from period_start_date)::int, 1)
          + interval '1 month' - interval '1 day')::date
    end
  ) stored,
  status text not null default 'draft'
    check (status in ('draft','submitted','approved','rejected')),
  rejection_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint valid_period_start check (extract(day from period_start_date)::int in (1, 16)),
  unique (employee_id, period_start_date)
);

-- ---------- TIMESHEET ENTRIES (hours per project code per day) ----------
create table public.timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  timesheet_id uuid not null references public.timesheets(id) on delete cascade,
  project_code_id uuid not null references public.project_codes(id),
  day_date date not null,
  hours numeric not null default 0 check (hours >= 0 and hours <= 24),
  notes text
);

-- ---------- PTO LEDGER (running vacation-balance history) ----------
create table public.pto_ledger (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null default current_date,
  hours numeric not null,              -- positive = grant/adjustment, negative = usage
  entry_type text not null check (entry_type in ('allotment','usage','adjustment')),
  timesheet_id uuid references public.timesheets(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- HELPER VIEW: current PTO balance per employee
-- =====================================================================
create view public.pto_balances as
select employee_id, coalesce(sum(hours),0) as balance
from public.pto_ledger
group by employee_id;

-- =====================================================================
-- TRIGGER: when a timesheet is approved, post VACATION-code hours to the
-- PTO ledger as usage (negative). Guards against double-posting if a
-- timesheet is approved more than once by only firing on the transition
-- INTO 'approved'.
-- =====================================================================
create or replace function public.post_vacation_usage()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    insert into public.pto_ledger (employee_id, entry_date, hours, entry_type, timesheet_id, note)
    select
      new.employee_id,
      new.period_start_date,
      -1 * sum(te.hours),
      'usage',
      new.id,
      'Vacation used, period starting ' || new.period_start_date
    from public.timesheet_entries te
    join public.project_codes pc on pc.id = te.project_code_id
    where te.timesheet_id = new.id and pc.code_type = 'VACATION'
    having sum(te.hours) > 0;
  end if;

  -- If an approved timesheet is reopened/rejected later, reverse any posted usage.
  if old.status = 'approved' and new.status <> 'approved' then
    delete from public.pto_ledger where timesheet_id = new.id and entry_type = 'usage';
  end if;

  return new;
end;
$$;

create trigger trg_post_vacation_usage
after update on public.timesheets
for each row execute function public.post_vacation_usage();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.project_codes enable row level security;
alter table public.timesheets enable row level security;
alter table public.timesheet_entries enable row level security;
alter table public.pto_ledger enable row level security;

-- Helper: is the current user an employer?
create or replace function public.is_employer()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'employer'
  );
$$;

-- PROFILES
create policy "employer full access to profiles" on public.profiles
  for all using (public.is_employer()) with check (public.is_employer());
create policy "employee reads own profile" on public.profiles
  for select using (id = auth.uid());
create policy "employee updates own contact info" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- PROJECT CODES
create policy "everyone reads active project codes" on public.project_codes
  for select using (active = true or public.is_employer());
create policy "employer manages project codes" on public.project_codes
  for all using (public.is_employer()) with check (public.is_employer());

-- TIMESHEETS
create policy "employer full access to timesheets" on public.timesheets
  for all using (public.is_employer()) with check (public.is_employer());
create policy "employee reads own timesheets" on public.timesheets
  for select using (employee_id = auth.uid());
create policy "employee inserts own timesheets" on public.timesheets
  for insert with check (employee_id = auth.uid());
create policy "employee updates own draft/rejected timesheets" on public.timesheets
  for update using (employee_id = auth.uid() and status in ('draft','rejected'))
  with check (employee_id = auth.uid());

-- TIMESHEET ENTRIES
create policy "employer full access to entries" on public.timesheet_entries
  for all using (public.is_employer()) with check (public.is_employer());
create policy "employee reads own entries" on public.timesheet_entries
  for select using (
    exists (select 1 from public.timesheets t where t.id = timesheet_id and t.employee_id = auth.uid())
  );
create policy "employee writes own draft/rejected entries" on public.timesheet_entries
  for all using (
    exists (select 1 from public.timesheets t where t.id = timesheet_id and t.employee_id = auth.uid()
            and t.status in ('draft','rejected'))
  ) with check (
    exists (select 1 from public.timesheets t where t.id = timesheet_id and t.employee_id = auth.uid()
            and t.status in ('draft','rejected'))
  );

-- PTO LEDGER
create policy "employer full access to pto ledger" on public.pto_ledger
  for all using (public.is_employer()) with check (public.is_employer());
create policy "employee reads own pto ledger" on public.pto_ledger
  for select using (employee_id = auth.uid());

-- =====================================================================
-- SEED DATA: default project codes required by spec
-- =====================================================================
insert into public.project_codes (code, customer_name, contract_task, labor_category, code_type) values
  ('HOLIDAY', 'Internal', 'N/A', 'N/A', 'HOLIDAY'),
  ('VACATION', 'Internal', 'N/A', 'N/A', 'VACATION'),
  ('CLIENT_SITE', 'General Client Site', 'N/A', 'N/A', 'CLIENT_SITE');

-- =====================================================================
-- NOTE ON THE FIRST EMPLOYER ACCOUNT
-- After you create your first user in Supabase Authentication tab,
-- run this (replace the email) to make them an employer:
--
--   insert into public.profiles (id, role, full_name, email, yearly_vacation_hours)
--   select id, 'employer', 'Admin', email, 0 from auth.users where email = 'you@example.com';
-- =====================================================================
