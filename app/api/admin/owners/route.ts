import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") return null;
  return user;
}

// GET /api/admin/owners — list all owners with profile data
export async function GET(): Promise<NextResponse> {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createAdminClient();
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const owners = users.filter((u) => u.user_metadata?.role === "owner");
  const ownerIds = owners.map((o) => o.id);

  // Fetch store counts + profiles in parallel
  const [{ data: stores }, { data: profiles }] = await Promise.all([
    supabase.from("stores").select("id, owner_id").in("owner_id", ownerIds),
    supabase.from("owner_profiles").select("*").in("user_id", ownerIds),
  ]);

  const storeCountMap: Record<string, number> = {};
  (stores ?? []).forEach((s) => {
    storeCountMap[s.owner_id] = (storeCountMap[s.owner_id] ?? 0) + 1;
  });

  type ProfileRow = { user_id: string; max_stores: number; max_employees: number; is_active: boolean };
  const profileMap: Record<string, ProfileRow> = {};
  ((profiles ?? []) as ProfileRow[]).forEach((p) => { profileMap[p.user_id] = p; });

  return NextResponse.json({
    owners: owners.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      name: (u.user_metadata?.name as string) ?? "",
      store_count: storeCountMap[u.id] ?? 0,
      created_at: u.created_at,
      max_stores: profileMap[u.id]?.max_stores ?? null,
      max_employees: profileMap[u.id]?.max_employees ?? null,
      is_active: profileMap[u.id]?.is_active ?? null,
    })),
  });
}

// POST /api/admin/owners — create owner account + profile
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { email: string; password: string; name: string; max_stores?: number; max_employees?: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { email, password, name, max_stores = 1, max_employees = 10 } = body;
  if (!email || !password || !name) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน (email, password, name)" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "owner", name },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Create profile record
  await supabase.from("owner_profiles").insert({
    user_id: data.user.id,
    max_stores,
    max_employees,
    is_active: true,
  });

  return NextResponse.json({
    success: true,
    owner: {
      id: data.user.id,
      email: data.user.email ?? "",
      name: (data.user.user_metadata?.name as string) ?? "",
      store_count: 0,
      created_at: data.user.created_at,
      max_stores,
      max_employees,
      is_active: true,
    },
  }, { status: 201 });
}

// PATCH /api/admin/owners — update name, password, and/or profile settings
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    owner_id: string;
    name?: string;
    password?: string;
    max_stores?: number;
    max_employees?: number;
    is_active?: boolean;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { owner_id, name, password, max_stores, max_employees, is_active } = body;
  if (!owner_id) return NextResponse.json({ error: "owner_id จำเป็น" }, { status: 400 });
  if (password && password.length < 6) {
    return NextResponse.json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
  }

  const supabase = await createAdminClient();

  // Update auth user (name, password)
  const authUpdates: Record<string, unknown> = {};
  if (name || password) {
    if (name) {
      const { data: existing } = await supabase.auth.admin.getUserById(owner_id);
      authUpdates.user_metadata = { ...existing?.user?.user_metadata, name };
    }
    if (password) authUpdates.password = password;
    const { error } = await supabase.auth.admin.updateUserById(owner_id, authUpdates);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Upsert profile (max_stores, max_employees, is_active)
  const hasProfileUpdate = max_stores !== undefined || max_employees !== undefined || is_active !== undefined;
  if (hasProfileUpdate) {
    const profileUpsert: { user_id: string; max_stores?: number; max_employees?: number; is_active?: boolean } = {
      user_id: owner_id,
    };
    if (max_stores !== undefined) profileUpsert.max_stores = max_stores;
    if (max_employees !== undefined) profileUpsert.max_employees = max_employees;
    if (is_active !== undefined) profileUpsert.is_active = is_active;

    const { error } = await supabase
      .from("owner_profiles")
      .upsert(profileUpsert, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/owners?owner_id=xxx — delete owner (cascades profile + stores + employees)
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owner_id = req.nextUrl.searchParams.get("owner_id");
  if (!owner_id) return NextResponse.json({ error: "owner_id จำเป็น" }, { status: 400 });

  const supabase = await createAdminClient();
  const { error } = await supabase.auth.admin.deleteUser(owner_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
