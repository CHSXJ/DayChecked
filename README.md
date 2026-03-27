# Employee Check-in System

ระบบลงชื่อเข้างานพนักงานผ่านมือถือ ตรวจสอบตำแหน่ง GPS ก่อนอนุญาตให้เช็คอิน/เช็คเอาท์

## Features

- **Owner**: สร้างร้าน กำหนดพิกัดและ radius, เพิ่ม/จัดการพนักงาน, ดู log และสรุปรายเดือน
- **Employee**: เลือกร้าน → กรอก PIN → ระบบตรวจ GPS → เช็คอิน/เอาท์
- **PWA**: ติดตั้งบนมือถือได้ (Add to Home Screen)
- **Security**: PIN เข้ารหัสด้วย bcrypt, GPS ตรวจฝั่ง server, RLS ใน Supabase

## Tech Stack

- Next.js 14 (App Router) + TypeScript
- Supabase (PostgreSQL + Auth + RLS)
- Tailwind CSS
- bcryptjs (edge-runtime compatible)
- Vercel (deploy)

---

## Setup Guide

### 1. สร้าง Supabase Project

1. ไปที่ [supabase.com](https://supabase.com) → New Project
2. จด Project URL และ API Keys ไว้

### 2. Run Migrations

ใน Supabase Dashboard → SQL Editor รัน:

```sql
-- รัน 001_init.sql ก่อน
-- แล้วรัน 002_rls.sql
```

คัดลอก content จาก `supabase/migrations/001_init.sql` และ `002_rls.sql` แล้วรันตามลำดับ

### 3. Seed ข้อมูลทดสอบ (optional)

```sql
-- แก้ YOUR_OWNER_UUID ก่อน แล้วรัน supabase/seed.sql
```

หา UUID ของ user ได้จาก Authentication → Users ใน Supabase Dashboard

**หมายเหตุ:** ต้อง regenerate PIN hash ก่อน:

```bash
node -e "const b=require('bcryptjs'); console.log(b.hashSync('5678',10)); console.log(b.hashSync('9999',10));"
```

แล้วแทนค่าใน seed.sql

### 4. ตั้งค่า Environment Variables

```bash
cp .env.local.example .env.local
```

แก้ไข `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

หา keys ได้จาก Supabase → Settings → API

### 5. Install & Run

```bash
npm install
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

### 6. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

ใส่ environment variables เดียวกันใน Vercel Dashboard → Settings → Environment Variables

---

## URL Structure

| Path | คำอธิบาย |
|------|----------|
| `/` | Redirect อัตโนมัติ (owner → `/dashboard`, ไม่ login → `/check-in`) |
| `/check-in` | หน้าพนักงาน (public) |
| `/dashboard` | Owner dashboard (ต้อง login) |
| `/login` | หน้าเข้าสู่ระบบ owner |
| `POST /api/attendance` | บันทึก check-in/out |
| `GET /api/attendance?store_id=&month=` | ดึง log + สรุป |
| `POST /api/employees` | สร้างพนักงาน (owner เท่านั้น) |

---

## Database Schema

```
stores
  id, name, lat, lng, radius_meters, owner_id, created_at

employees
  id, store_id, name, pin_hash, is_active, created_at

attendance_logs
  id, employee_id, store_id, type(in/out), checked_at, lat, lng, is_valid_location
```

---

## Check-in Flow

```
พนักงาน เลือกร้าน → เลือกชื่อ → กด PIN (4 หลัก)
  → Client ขอ GPS permission
  → Client ตรวจ distance (preview)
  → POST /api/attendance { employee_id, store_id, type, lat, lng, pin }
  → Server: verify PIN (bcrypt) → validate GPS (haversine) → check duplicate → INSERT log
  → Response: success + timestamp
```

---

## Supabase Auth Setup

1. Dashboard → Authentication → Providers → Email: เปิดใช้งาน
2. Dashboard → Authentication → Email Templates: ปรับแต่งตามต้องการ
3. Dashboard → Authentication → URL Configuration:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: `https://your-app.vercel.app/dashboard`

---

## Local Development with Supabase CLI (optional)

```bash
npm install -g supabase
supabase init
supabase start
supabase db push
```

---

## Project Structure

```
checkin-app/
├── app/
│   ├── (employee)/check-in/page.tsx   # หน้าพนักงาน
│   ├── (owner)/dashboard/page.tsx     # หน้า owner
│   ├── api/attendance/route.ts        # POST/GET attendance
│   ├── api/employees/route.ts         # POST/PATCH employees
│   ├── login/page.tsx                 # Auth page
│   ├── layout.tsx
│   └── page.tsx                       # Root redirect
├── components/
│   ├── PinPad.tsx                     # Numeric keypad
│   ├── CheckInButton.tsx              # GPS + API button
│   ├── AttendanceTable.tsx            # Log table + summary
│   └── ServiceWorkerRegister.tsx      # PWA SW registration
├── lib/
│   ├── supabase.ts                    # Browser + Server + Admin clients
│   ├── gps.ts                         # Haversine distance
│   ├── auth.ts                        # PIN hash/verify (bcryptjs)
│   ├── types.ts                       # TypeScript interfaces
│   └── database.types.ts             # Supabase DB types
├── public/
│   ├── manifest.json                  # PWA manifest
│   └── sw.js                          # Service worker
└── supabase/
    ├── migrations/001_init.sql
    ├── migrations/002_rls.sql
    └── seed.sql
```
