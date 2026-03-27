-- Enable UUID extension
create extension if not exists "pgcrypto";

-- =====================
-- Table: stores
-- =====================
create table if not exists public.stores (
  id             uuid        primary key default gen_random_uuid(),
  name           text        not null,
  lat            float8      not null,
  lng            float8      not null,
  radius_meters  int4        not null default 100,
  owner_id       uuid        not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now()
);

-- =====================
-- Table: employees
-- =====================
create table if not exists public.employees (
  id          uuid        primary key default gen_random_uuid(),
  store_id    uuid        not null references public.stores(id) on delete cascade,
  name        text        not null,
  pin_hash    text        not null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- =====================
-- Table: attendance_logs
-- =====================
create table if not exists public.attendance_logs (
  id                 uuid        primary key default gen_random_uuid(),
  employee_id        uuid        not null references public.employees(id) on delete cascade,
  store_id           uuid        not null references public.stores(id) on delete cascade,
  type               text        not null check (type in ('in', 'out')),
  checked_at         timestamptz not null default now(),
  lat                float8      not null,
  lng                float8      not null,
  is_valid_location  boolean     not null default false
);

-- Indexes for common queries
create index if not exists idx_attendance_logs_employee_id
  on public.attendance_logs(employee_id);

create index if not exists idx_attendance_logs_store_id
  on public.attendance_logs(store_id);

create index if not exists idx_attendance_logs_checked_at
  on public.attendance_logs(checked_at);

create index if not exists idx_employees_store_id
  on public.employees(store_id);
