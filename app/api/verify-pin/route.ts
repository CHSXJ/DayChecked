import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { verifyPin, isValidPin } from "@/lib/auth";

// POST /api/verify-pin
// Body: { employee_id: string; pin: string }
// Response: { valid: boolean }
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { employee_id: string; pin: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ valid: false }, { status: 400 }); }

  const { employee_id, pin } = body;
  if (!employee_id || !pin || !isValidPin(pin)) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data: emp } = await supabase
    .from("employees")
    .select("pin_hash")
    .eq("id", employee_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!emp) return NextResponse.json({ valid: false });

  const valid = await verifyPin(pin, emp.pin_hash);
  return NextResponse.json({ valid });
}
