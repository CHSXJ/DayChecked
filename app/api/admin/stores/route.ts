import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") return null;
  return user;
}

// GET /api/admin/stores?owner_id=xxx (optional filter) — list all stores with owner info
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owner_id = req.nextUrl.searchParams.get("owner_id");
  const supabase = await createAdminClient();

  let query = supabase.from("stores").select("*").order("created_at", { ascending: false });
  if (owner_id) query = query.eq("owner_id", owner_id);

  const { data: stores, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch employee counts
  const storeIds = (stores ?? []).map((s) => s.id);
  const { data: employees } = storeIds.length > 0
    ? await supabase.from("employees").select("id, store_id").in("store_id", storeIds)
    : { data: [] };

  const empCountMap: Record<string, number> = {};
  (employees ?? []).forEach((e) => {
    empCountMap[e.store_id] = (empCountMap[e.store_id] ?? 0) + 1;
  });

  // Fetch owner info for unique owner_ids
  const ownerIds = Array.from(new Set((stores ?? []).map((s) => s.owner_id)));
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const ownerMap: Record<string, { email: string; name: string }> = {};
  users
    .filter((u) => ownerIds.includes(u.id))
    .forEach((u) => {
      ownerMap[u.id] = {
        email: u.email ?? "",
        name: (u.user_metadata?.name as string) ?? "",
      };
    });

  return NextResponse.json({
    stores: (stores ?? []).map((s) => ({
      ...s,
      owner_email: ownerMap[s.owner_id]?.email ?? "",
      owner_name: ownerMap[s.owner_id]?.name ?? "",
      employee_count: empCountMap[s.id] ?? 0,
    })),
  });
}

// POST /api/admin/stores — create store for any owner
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { owner_id: string; name: string; lat: number; lng: number; radius_meters: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { owner_id, name, lat, lng, radius_meters } = body;
  if (!owner_id || !name || lat == null || lng == null || !radius_meters) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data: store, error } = await supabase
    .from("stores")
    .insert({ owner_id, name, lat, lng, radius_meters })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, store }, { status: 201 });
}

// PATCH /api/admin/stores — update any store
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { store_id: string; name?: string; lat?: number; lng?: number; radius_meters?: number; owner_id?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { store_id, ...updates } = body;
  if (!store_id) return NextResponse.json({ error: "store_id จำเป็น" }, { status: 400 });

  const supabase = await createAdminClient();
  const { error } = await supabase.from("stores").update(updates).eq("id", store_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE /api/admin/stores?store_id=xxx — delete store (cascades employees + logs)
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store_id = req.nextUrl.searchParams.get("store_id");
  if (!store_id) return NextResponse.json({ error: "store_id จำเป็น" }, { status: 400 });

  const supabase = await createAdminClient();
  const { error } = await supabase.from("stores").delete().eq("id", store_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
