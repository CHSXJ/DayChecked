import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase-server";

// POST /api/stores — create a store for the authenticated owner (enforces max_stores limit)
export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabaseUser = await createServerSupabaseClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name: string; lat: number; lng: number; radius_meters: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { name, lat, lng, radius_meters } = body;
  if (!name || lat == null || lng == null || !radius_meters) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
  }

  const supabase = await createAdminClient();

  // Fetch profile and current store count in parallel
  const [{ data: profile }, { count: storeCount }] = await Promise.all([
    supabase.from("owner_profiles").select("max_stores, is_active").eq("user_id", user.id).maybeSingle(),
    supabase.from("stores").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
  ]);

  // If profile exists, enforce limits
  if (profile) {
    if (!profile.is_active) {
      return NextResponse.json({ error: "บัญชีถูกระงับ" }, { status: 403 });
    }
    if ((storeCount ?? 0) >= profile.max_stores) {
      return NextResponse.json({
        error: `ถึงขีดจำกัดแล้ว (สูงสุด ${profile.max_stores} ร้าน)`,
        limit_reached: true,
      }, { status: 403 });
    }
  }

  const { data: store, error } = await supabase
    .from("stores")
    .insert({ name, lat, lng, radius_meters, owner_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, store }, { status: 201 });
}
