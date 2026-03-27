-- =====================
-- Row Level Security
-- =====================

-- Enable RLS on all tables
alter table public.stores          enable row level security;
alter table public.employees       enable row level security;
alter table public.attendance_logs enable row level security;

-- =====================
-- stores: owner sees only their own stores
-- =====================
create policy "owner_select_stores"
  on public.stores for select
  using (owner_id = auth.uid());

create policy "owner_insert_stores"
  on public.stores for insert
  with check (owner_id = auth.uid());

create policy "owner_update_stores"
  on public.stores for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "owner_delete_stores"
  on public.stores for delete
  using (owner_id = auth.uid());

-- Public read for employee check-in page (need store list & location)
create policy "public_read_stores"
  on public.stores for select
  using (true);

-- =====================
-- employees: owner manages; anyone can read active employees for check-in
-- =====================
create policy "public_read_active_employees"
  on public.employees for select
  using (is_active = true);

create policy "owner_select_employees"
  on public.employees for select
  using (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
    )
  );

create policy "owner_insert_employees"
  on public.employees for insert
  with check (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
    )
  );

create policy "owner_update_employees"
  on public.employees for update
  using (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
    )
  )
  with check (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
    )
  );

create policy "owner_delete_employees"
  on public.employees for delete
  using (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
    )
  );

-- =====================
-- attendance_logs: owner sees logs for their stores; service role inserts
-- =====================
create policy "owner_select_attendance"
  on public.attendance_logs for select
  using (
    store_id in (
      select id from public.stores where owner_id = auth.uid()
    )
  );

-- Public insert is handled via service-role key in API route
-- (service-role bypasses RLS, so no explicit policy needed for insert)
-- If you want to allow insert via anon key instead, uncomment below:
-- create policy "public_insert_attendance"
--   on public.attendance_logs for insert
--   with check (true);
