import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { verifyPin, isValidPin } from "@/lib/auth";
import { isWithinRadius } from "@/lib/gps";
import type {
  CheckInRequest,
  CheckInResponse,
  AttendanceLogWithEmployee,
} from "@/lib/types";

// ─────────────────────────────────────────────
// POST /api/attendance
// Body: CheckInRequest
// ─────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse<CheckInResponse>> {
  let body: CheckInRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { employee_id, store_id, type, lat, lng, pin } = body;

  // 1. Basic validation
  if (!employee_id || !store_id || !type || lat == null || lng == null || !pin) {
    return NextResponse.json(
      { success: false, error: "ข้อมูลไม่ครบถ้วน" },
      { status: 400 }
    );
  }

  if (type !== "in" && type !== "out") {
    return NextResponse.json(
      { success: false, error: "ประเภทต้องเป็น in หรือ out" },
      { status: 400 }
    );
  }

  if (!isValidPin(pin)) {
    return NextResponse.json(
      { success: false, error: "PIN ต้องเป็นตัวเลข 4 หลัก" },
      { status: 400 }
    );
  }

  const supabase = await createAdminClient();

  // 2. Fetch employee + store in parallel
  const [empResult, storeResult] = await Promise.all([
    supabase
      .from("employees")
      .select("id, pin_hash, is_active, store_id")
      .eq("id", employee_id)
      .single(),
    supabase
      .from("stores")
      .select("id, lat, lng, radius_meters")
      .eq("id", store_id)
      .single(),
  ]);

  if (empResult.error || !empResult.data) {
    return NextResponse.json(
      { success: false, error: "ไม่พบพนักงาน" },
      { status: 404 }
    );
  }

  if (storeResult.error || !storeResult.data) {
    return NextResponse.json(
      { success: false, error: "ไม่พบร้านค้า" },
      { status: 404 }
    );
  }

  const employee = empResult.data;
  const store = storeResult.data;

  // 3. Verify employee belongs to store
  if (employee.store_id !== store_id) {
    return NextResponse.json(
      { success: false, error: "พนักงานไม่ได้สังกัดร้านนี้" },
      { status: 403 }
    );
  }

  // 4. Check employee active status
  if (!employee.is_active) {
    return NextResponse.json(
      { success: false, error: "บัญชีพนักงานถูกระงับ" },
      { status: 403 }
    );
  }

  // 5. Verify PIN
  const pinValid = await verifyPin(pin, employee.pin_hash);
  if (!pinValid) {
    return NextResponse.json(
      { success: false, error: "PIN ไม่ถูกต้อง" },
      { status: 401 }
    );
  }

  // 6. Server-side GPS validation
  const isValidLocation = isWithinRadius(lat, lng, store.lat, store.lng, store.radius_meters);
  if (!isValidLocation) {
    return NextResponse.json(
      {
        success: false,
        error: `ตำแหน่งอยู่นอกพื้นที่ร้าน (radius ${store.radius_meters} เมตร)`,
      },
      { status: 403 }
    );
  }

  // 7. Prevent duplicate check-in / check-out
  const { data: lastLog } = await supabase
    .from("attendance_logs")
    .select("type")
    .eq("employee_id", employee_id)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastType = lastLog?.type ?? null;

  if (type === "in" && lastType === "in") {
    return NextResponse.json(
      { success: false, error: "คุณได้เช็คอินแล้ว กรุณาเช็คเอาท์ก่อน" },
      { status: 409 }
    );
  }

  if (type === "out" && lastType !== "in") {
    return NextResponse.json(
      { success: false, error: "ยังไม่ได้เช็คอิน" },
      { status: 409 }
    );
  }

  // 8. Insert log
  const { data: log, error: insertError } = await supabase
    .from("attendance_logs")
    .insert({
      employee_id,
      store_id,
      type,
      lat,
      lng,
      is_valid_location: isValidLocation,
    })
    .select()
    .single();

  if (insertError || !log) {
    console.error("Insert error:", insertError);
    return NextResponse.json(
      { success: false, error: "บันทึกข้อมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, log });
}

// ─────────────────────────────────────────────
// GET /api/attendance?store_id=xxx&month=YYYY-MM
// ─────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const store_id = searchParams.get("store_id");
  const month = searchParams.get("month"); // YYYY-MM

  if (!store_id || !month) {
    return NextResponse.json(
      { error: "store_id และ month จำเป็นต้องระบุ" },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month ต้องอยู่ในรูปแบบ YYYY-MM" },
      { status: 400 }
    );
  }

  const [year, mon] = month.split("-").map(Number);
  const startDate = new Date(year, mon - 1, 1).toISOString();
  const endDate = new Date(year, mon, 1).toISOString();

  const supabase = await createAdminClient();

  const { data: logs, error } = await supabase
    .from("attendance_logs")
    .select("*, employees(name)")
    .eq("store_id", store_id)
    .gte("checked_at", startDate)
    .lt("checked_at", endDate)
    .order("checked_at", { ascending: true });

  if (error) {
    console.error("Query error:", error);
    return NextResponse.json(
      { error: "ดึงข้อมูลไม่สำเร็จ" },
      { status: 500 }
    );
  }

  const typedLogs = (logs ?? []) as AttendanceLogWithEmployee[];

  return NextResponse.json({ logs: typedLogs, month }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
