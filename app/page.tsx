import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Parallel queries — no need to wait for one before the other
  const [{ count: storeCount }, { data: employee }] = await Promise.all([
    supabase.from("stores").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    supabase.from("employees").select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
  ]);

  if (storeCount && storeCount > 0) redirect("/dashboard");
  if (employee) redirect("/check-in");

  // New user — go to dashboard to set up their first store
  redirect("/dashboard");
}
