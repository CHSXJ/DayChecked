  -- Add user_id to employees so each employee links to a Supabase auth account
  alter table public.employees
    add column if not exists user_id uuid references auth.users(id) on delete set null;

  create unique index if not exists idx_employees_user_id
    on public.employees(user_id)
    where user_id is not null;

  -- Allow employees to read their own record via user_id
  create policy "employee_read_own"
    on public.employees for select
    using (user_id = auth.uid());

  -- Allow employees to read their own attendance logs
  create policy "employee_read_own_logs"
    on public.attendance_logs for select
    using (
      employee_id in (
        select id from public.employees where user_id = auth.uid()
      )
    );
