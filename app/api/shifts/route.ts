import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";

async function getUser() {
  const s = await createServerSupabaseClient();
  return (await s.auth.getUser()).data.user;
}

async function isStoreOwner(supabase: Awaited<ReturnType<typeof createAdminClient>>, store_id: string, user_id: string) {
  const { data: store } = await supabase.from("stores").select("owner_id").eq("id", store_id).maybeSingle();
  if (!store) return false;
  if (store.owner_id === user_id) return true;
  const { data: co } = await supabase.from("store_owners").select("store_id").eq("store_id", store_id).eq("user_id", user_id).maybeSingle();
  return !!co;
}

// GET /api/shifts?store_id=xxx
export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store_id = req.nextUrl.searchParams.get("store_id");
  if (!store_id) return NextResponse.json({ error: "store_id จำเป็น" }, { status: 400 });

  const supabase = await createAdminClient();
  const { data, error } = await supabase.from("shifts").select("*").eq("store_id", store_id).order("start_time");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shifts: data });
}

// POST /api/shifts — create shift
export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { store_id: string; name: string; start_time: string; end_time: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { store_id, name, start_time, end_time } = body;
  if (!store_id || !name || !start_time || !end_time) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
  }

  const supabase = await createAdminClient();
  if (!(await isStoreOwner(supabase, store_id, user.id))) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const { data, error } = await supabase.from("shifts").insert({ store_id, name, start_time, end_time }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shift: data }, { status: 201 });
}

// PATCH /api/shifts — update shift
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { shift_id: string; name?: string; start_time?: string; end_time?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { shift_id, ...updates } = body;
  if (!shift_id) return NextResponse.json({ error: "shift_id จำเป็น" }, { status: 400 });

  const supabase = await createAdminClient();
  const { data: shift } = await supabase.from("shifts").select("store_id").eq("id", shift_id).maybeSingle();
  if (!shift) return NextResponse.json({ error: "ไม่พบกะ" }, { status: 404 });
  if (!(await isStoreOwner(supabase, shift.store_id, user.id))) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const { error } = await supabase.from("shifts").update(updates).eq("id", shift_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/shifts?shift_id=xxx
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shift_id = req.nextUrl.searchParams.get("shift_id");
  if (!shift_id) return NextResponse.json({ error: "shift_id จำเป็น" }, { status: 400 });

  const supabase = await createAdminClient();
  const { data: shift } = await supabase.from("shifts").select("store_id").eq("id", shift_id).maybeSingle();
  if (!shift) return NextResponse.json({ error: "ไม่พบกะ" }, { status: 404 });
  if (!(await isStoreOwner(supabase, shift.store_id, user.id))) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const { error } = await supabase.from("shifts").delete().eq("id", shift_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
