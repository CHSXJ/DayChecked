import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";

async function getActingUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET /api/store-owners?store_id=xxx
// Returns all owners (primary + co-owners) with name/email
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getActingUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store_id = req.nextUrl.searchParams.get("store_id");
  if (!store_id) return NextResponse.json({ error: "store_id จำเป็น" }, { status: 400 });

  const supabase = await createAdminClient();

  // Verify requester is primary owner or co-owner
  const { data: store } = await supabase.from("stores").select("owner_id").eq("id", store_id).maybeSingle();
  if (!store) return NextResponse.json({ error: "ไม่พบร้าน" }, { status: 404 });

  const isPrimary = store.owner_id === user.id;
  if (!isPrimary) {
    const { data: co } = await supabase.from("store_owners").select("store_id").eq("store_id", store_id).eq("user_id", user.id).maybeSingle();
    if (!co) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  // Get co-owner user_ids
  const { data: coRows } = await supabase.from("store_owners").select("user_id, created_at").eq("store_id", store_id);
  const allUserIds = [store.owner_id, ...(coRows ?? []).map((r) => r.user_id)];

  // Fetch user details
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userMap = Object.fromEntries(users.map((u) => [u.id, { email: u.email ?? "", name: (u.user_metadata?.name as string) ?? "" }]));

  const owners = allUserIds.map((uid) => ({
    user_id: uid,
    email: userMap[uid]?.email ?? "",
    name: userMap[uid]?.name ?? "",
    is_primary: uid === store.owner_id,
    created_at: uid === store.owner_id ? null : (coRows?.find((r) => r.user_id === uid)?.created_at ?? null),
  }));

  return NextResponse.json({ owners });
}

// POST /api/store-owners — add co-owner by email (primary owner only)
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getActingUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { store_id: string; email: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { store_id, email } = body;
  if (!store_id || !email) return NextResponse.json({ error: "store_id และ email จำเป็น" }, { status: 400 });

  const supabase = await createAdminClient();

  // Only primary owner can add co-owners
  const { data: store } = await supabase.from("stores").select("owner_id").eq("id", store_id).eq("owner_id", user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: "ไม่พบร้าน หรือไม่ใช่เจ้าของหลัก" }, { status: 403 });

  // Find user by email
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const target = users.find((u) => u.email === email);
  if (!target) return NextResponse.json({ error: "ไม่พบบัญชีอีเมลนี้" }, { status: 404 });
  if (target.user_metadata?.role !== "owner") return NextResponse.json({ error: "บัญชีนี้ไม่ใช่บัญชีเจ้าของร้าน" }, { status: 400 });
  if (target.id === user.id) return NextResponse.json({ error: "ไม่สามารถเพิ่มตัวเองได้" }, { status: 400 });

  // Check not already co-owner
  const { data: existing } = await supabase.from("store_owners").select("store_id").eq("store_id", store_id).eq("user_id", target.id).maybeSingle();
  if (existing) return NextResponse.json({ error: "บัญชีนี้เป็นเจ้าของร้านนี้อยู่แล้ว" }, { status: 409 });

  const { error } = await supabase.from("store_owners").insert({ store_id, user_id: target.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    owner: { user_id: target.id, email: target.email ?? "", name: (target.user_metadata?.name as string) ?? "", is_primary: false },
  }, { status: 201 });
}

// DELETE /api/store-owners?store_id=xxx&user_id=yyy — remove co-owner (primary owner only)
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const user = await getActingUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store_id = req.nextUrl.searchParams.get("store_id");
  const target_user_id = req.nextUrl.searchParams.get("user_id");
  if (!store_id || !target_user_id) return NextResponse.json({ error: "store_id และ user_id จำเป็น" }, { status: 400 });

  const supabase = await createAdminClient();

  // Only primary owner can remove co-owners
  const { data: store } = await supabase.from("stores").select("owner_id").eq("id", store_id).eq("owner_id", user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  if (target_user_id === user.id) return NextResponse.json({ error: "ไม่สามารถลบเจ้าของหลักได้" }, { status: 400 });

  const { error } = await supabase.from("store_owners").delete().eq("store_id", store_id).eq("user_id", target_user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
