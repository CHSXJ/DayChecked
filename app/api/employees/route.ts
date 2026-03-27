import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase-server";
import { hashPin, isValidPin } from "@/lib/auth";

interface CreateEmployeeBody {
  store_id: string;
  name: string;
  pin: string;
  self?: boolean;
  email?: string;
  password?: string;
}

// POST /api/employees — create Supabase auth user + employee record
export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabaseUser = await createServerSupabaseClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CreateEmployeeBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { store_id, name, pin, self: isSelf, email, password } = body;

  if (!store_id || !name || !pin) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
  }
  if (!isValidPin(pin)) {
    return NextResponse.json({ error: "PIN ต้องเป็นตัวเลข 4 หลัก" }, { status: 400 });
  }
  if (!isSelf && (!email || !password)) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
  }
  if (!isSelf && password && password.length < 6) {
    return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
  }

  const supabase = await createAdminClient();

  // Verify store belongs to this owner
  const { data: store } = await supabase
    .from("stores").select("id, owner_id").eq("id", store_id).eq("owner_id", user.id).single();
  if (!store) return NextResponse.json({ error: "ไม่พบร้าน หรือไม่มีสิทธิ์" }, { status: 403 });

  // Enforce max_employees limit (total across all owner's stores)
  const [{ data: profile }, { count: empCount }] = await Promise.all([
    supabase.from("owner_profiles").select("max_employees").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .in("store_id",
        (await supabase.from("stores").select("id").eq("owner_id", user.id)).data?.map((s) => s.id) ?? []
      ),
  ]);

  if (profile && (empCount ?? 0) >= profile.max_employees) {
    return NextResponse.json({
      error: `ถึงขีดจำกัดแล้ว (สูงสุด ${profile.max_employees} พนักงาน)`,
      limit_reached: true,
    }, { status: 403 });
  }

  let employeeUserId: string;

  if (isSelf) {
    // Owner registers themselves as an employee — no new auth user needed
    employeeUserId = user.id;
  } else {
    // Create a new Supabase auth user for the employee
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email!,
      password: password!,
      email_confirm: true,
      user_metadata: { role: "employee", name },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? "สร้าง auth user ไม่สำเร็จ" },
        { status: 500 }
      );
    }
    employeeUserId = authData.user.id;
  }

  const pin_hash = await hashPin(pin);

  const { data: employee, error: empError } = await supabase
    .from("employees")
    .insert({ store_id, name, pin_hash, user_id: employeeUserId })
    .select("id, store_id, name, is_active, user_id, created_at")
    .single();

  if (empError) {
    // Rollback: delete the auth user we just created (only if we created one)
    if (!isSelf) await supabase.auth.admin.deleteUser(employeeUserId);
    return NextResponse.json({ error: "สร้างพนักงานไม่สำเร็จ" }, { status: 500 });
  }

  return NextResponse.json({ success: true, employee }, { status: 201 });
}

// PATCH /api/employees — update name or PIN
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const supabaseUser = await createServerSupabaseClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { employee_id: string; name?: string; pin?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { employee_id, name, pin } = body;
  if (!employee_id) return NextResponse.json({ error: "employee_id จำเป็น" }, { status: 400 });
  if (pin && !isValidPin(pin)) return NextResponse.json({ error: "PIN ต้องเป็นตัวเลข 4 หลัก" }, { status: 400 });

  const supabase = await createAdminClient();

  const { data: emp } = await supabase
    .from("employees")
    .select("id, store_id, stores(owner_id)")
    .eq("id", employee_id)
    .single();

  if (!emp) return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 404 });

  const store = emp.stores as { owner_id: string } | null;
  if (!store || store.owner_id !== user.id) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const updates: Record<string, string> = {};
  if (name) updates.name = name;
  if (pin) updates.pin_hash = await hashPin(pin);

  const { error } = await supabase.from("employees").update(updates).eq("id", employee_id);
  if (error) return NextResponse.json({ error: "อัปเดตไม่สำเร็จ" }, { status: 500 });

  return NextResponse.json({ success: true });
}
