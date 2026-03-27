-- =====================
-- Table: owner_profiles
-- Stores subscription settings per owner account
-- =====================
create table if not exists public.owner_profiles (
  user_id       uuid        primary key references auth.users(id) on delete cascade,
  max_stores    int         not null default 1,
  max_employees int         not null default 10,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now()
);

-- Enable RLS
alter table public.owner_profiles enable row level security;

-- Owners can read their own profile (to show limits in dashboard)
create policy "owner_read_own_profile"
  on public.owner_profiles for select
  using (user_id = auth.uid());

-- Write operations are performed via service-role key (admin only)
-- No additional policies needed for insert/update/delete
