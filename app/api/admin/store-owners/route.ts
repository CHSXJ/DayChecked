import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";

async function requireAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.user_metadata?.role !== "admin") return null;
  return user;
}

// GET /api/admin/store-owners?store_id=xxx
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store_id = req.nextUrl.searchParams.get("store_id");
  if (!store_id) return NextResponse.json({ error: "store_id จำเป็น" }, { status: 400 });

  const supabase = await createAdminClient();

  const { data: store } = await supabase.from("stores").select("owner_id").eq("id", store_id).maybeSingle();
  if (!store) return NextResponse.json({ error: "ไม่พบร้าน" }, { status: 404 });

  const { data: coRows } = await supabase.from("store_owners").select("user_id").eq("store_id", store_id);
  const allUserIds = [store.owner_id, ...(coRows ?? []).map((r) => r.user_id)];

  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const userMap = Object.fromEntries(users.map((u) => [u.id, { email: u.email ?? "", name: (u.user_metadata?.name as string) ?? "" }]));

  const owners = allUserIds.map((uid) => ({
    user_id: uid,
    email: userMap[uid]?.email ?? "",
    name: userMap[uid]?.name ?? "",
    is_primary: uid === store.owner_id,
  }));

  return NextResponse.json({ owners });
}

// POST /api/admin/store-owners — add co-owner by user_id
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { store_id: string; user_id: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { store_id, user_id } = body;
  if (!store_id || !user_id) return NextResponse.json({ error: "store_id และ user_id จำเป็น" }, { status: 400 });

  const supabase = await createAdminClient();

  const { data: store } = await supabase.from("stores").select("owner_id").eq("id", store_id).maybeSingle();
  if (!store) return NextResponse.json({ error: "ไม่พบร้าน" }, { status: 404 });
  if (store.owner_id === user_id) return NextResponse.json({ error: "เป็นเจ้าของหลักอยู่แล้ว" }, { status: 400 });

  const { data: existing } = await supabase.from("store_owners").select("store_id").eq("store_id", store_id).eq("user_id", user_id).maybeSingle();
  if (existing) return NextResponse.json({ error: "เป็นเจ้าของร้านนี้อยู่แล้ว" }, { status: 409 });

  const { error } = await supabase.from("store_owners").insert({ store_id, user_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true }, { status: 201 });
}

// DELETE /api/admin/store-owners?store_id=xxx&user_id=yyy
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store_id = req.nextUrl.searchParams.get("store_id");
  const user_id = req.nextUrl.searchParams.get("user_id");
  if (!store_id || !user_id) return NextResponse.json({ error: "store_id และ user_id จำเป็น" }, { status: 400 });

  const supabase = await createAdminClient();

  const { data: store } = await supabase.from("stores").select("owner_id").eq("id", store_id).maybeSingle();
  if (!store) return NextResponse.json({ error: "ไม่พบร้าน" }, { status: 404 });
  if (store.owner_id === user_id) return NextResponse.json({ error: "ไม่สามารถลบเจ้าของหลักได้" }, { status: 400 });

  const { error } = await supabase.from("store_owners").delete().eq("store_id", store_id).eq("user_id", user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
