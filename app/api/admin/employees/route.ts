import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";
import { hashPin, isValidPin } from "@/lib/auth";

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") return null;
  return user;
}

// GET /api/admin/employees?store_id=xxx — list employees for a store
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store_id = req.nextUrl.searchParams.get("store_id");
  if (!store_id) return NextResponse.json({ error: "store_id จำเป็น" }, { status: 400 });

  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, store_id, name, is_active, user_id, created_at")
    .eq("store_id", store_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ employees: data ?? [] });
}

// POST /api/admin/employees — create employee for any store
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { store_id: string; name: string; pin: string; email?: string; password?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { store_id, name, pin, email, password } = body;
  if (!store_id || !name || !pin) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน (store_id, name, pin)" }, { status: 400 });
  }
  if (!isValidPin(pin)) {
    return NextResponse.json({ error: "PIN ต้องเป็นตัวเลข 4 หลัก" }, { status: 400 });
  }
  if ((email || password) && (!email || !password)) {
    return NextResponse.json({ error: "ต้องระบุทั้ง email และ password" }, { status: 400 });
  }
  if (password && password.length < 6) {
    return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
  }

  const supabase = await createAdminClient();

  // Verify store exists
  const { data: store } = await supabase.from("stores").select("id").eq("id", store_id).single();
  if (!store) return NextResponse.json({ error: "ไม่พบร้านค้า" }, { status: 404 });

  let employeeUserId: string | null = null;

  if (email && password) {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "employee", name },
    });
    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message ?? "สร้าง auth user ไม่สำเร็จ" }, { status: 500 });
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
    if (employeeUserId) await supabase.auth.admin.deleteUser(employeeUserId);
    return NextResponse.json({ error: "สร้างพนักงานไม่สำเร็จ" }, { status: 500 });
  }

  return NextResponse.json({ success: true, employee }, { status: 201 });
}

// PATCH /api/admin/employees — update employee name, pin, or active status
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { employee_id: string; name?: string; pin?: string; is_active?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { employee_id, name, pin, is_active } = body;
  if (!employee_id) return NextResponse.json({ error: "employee_id จำเป็น" }, { status: 400 });
  if (pin && !isValidPin(pin)) return NextResponse.json({ error: "PIN ต้องเป็นตัวเลข 4 หลัก" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (pin) updates.pin_hash = await hashPin(pin);
  if (is_active !== undefined) updates.is_active = is_active;

  const supabase = await createAdminClient();
  const { error } = await supabase.from("employees").update(updates).eq("id", employee_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/employees?employee_id=xxx
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employee_id = req.nextUrl.searchParams.get("employee_id");
  if (!employee_id) return NextResponse.json({ error: "employee_id จำเป็น" }, { status: 400 });

  const supabase = await createAdminClient();

  // Fetch user_id to delete auth account too (if exists)
  const { data: emp } = await supabase
    .from("employees")
    .select("user_id")
    .eq("id", employee_id)
    .single();

  const { error } = await supabase.from("employees").delete().eq("id", employee_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (emp?.user_id) {
    await supabase.auth.admin.deleteUser(emp.user_id).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
