-- Composite index for the most common query: monthly attendance by store
create index if not exists idx_attendance_logs_store_checked
  on public.attendance_logs(store_id, checked_at);

-- Index for latest log per employee (check-in page & duplicate prevention)
create index if not exists idx_attendance_logs_employee_checked
  on public.attendance_logs(employee_id, checked_at desc);

-- Index for owner's stores lookup
create index if not exists idx_stores_owner_id
  on public.stores(owner_id);

-- Index for employee lookup by user_id (check-in page login)
create index if not exists idx_employees_user_id
  on public.employees(user_id)
  where user_id is not null;

-- Index for active employees filter
create index if not exists idx_employees_is_active
  on public.employees(store_id, is_active);
