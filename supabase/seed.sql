-- =====================
-- Seed data for testing
-- NOTE: Run this AFTER creating a user via Supabase Auth (email/password).
--       Replace 'YOUR_OWNER_UUID' with the actual user UUID from auth.users.
-- =====================

-- 1. Create a test store (Central Bangkok area)
insert into public.stores (id, name, lat, lng, radius_meters, owner_id)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'ร้านทดสอบ สาขาสยาม',
  13.7466,
  100.5340,
  200,
  'YOUR_OWNER_UUID'   -- ← Replace with your auth.users UUID
);

-- 2. Create 3 test employees (PINs: 1234, 5678, 9999)
--    pin_hash values below correspond to bcrypt hash of those PINs (cost=10)
--    You can regenerate them via: node -e "const b=require('bcryptjs'); console.log(b.hashSync('1234',10))"

insert into public.employees (id, store_id, name, pin_hash, is_active)
values
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'สมชาย ใจดี',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- PIN: 1234
    true
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'สมหญิง รักงาน',
    '$2a$10$p0t5h8bU8m1H.d.YE5Jz7O5J5Q5J5J5J5J5J5J5J5J5J5J5J5',  -- PIN: 5678 (regenerate!)
    true
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'มานะ ขยันดี',
    '$2a$10$q1u6i9cV9n2I.e.ZF6K8P.6K6R6K6K6K6K6K6K6K6K6K6K6K6',  -- PIN: 9999 (regenerate!)
    true
  );

-- 3. Sample attendance logs (past month)
insert into public.attendance_logs (employee_id, store_id, type, checked_at, lat, lng, is_valid_location)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'in',  now() - interval '2 days' + interval '8 hours',  13.7466, 100.5340, true),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'out', now() - interval '2 days' + interval '17 hours', 13.7466, 100.5340, true),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'in',  now() - interval '2 days' + interval '9 hours',  13.7466, 100.5340, true),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'out', now() - interval '2 days' + interval '18 hours', 13.7466, 100.5340, true),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'in',  now() - interval '1 day'  + interval '8 hours',  13.7466, 100.5340, true),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'out', now() - interval '1 day'  + interval '16 hours', 13.7466, 100.5340, true);

-- =====================
-- To generate fresh PIN hashes, run in Node.js:
-- const b = require('bcryptjs');
-- console.log(b.hashSync('5678', 10));
-- console.log(b.hashSync('9999', 10));
-- Then update the insert above.
-- =====================
