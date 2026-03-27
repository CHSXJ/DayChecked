import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = user.user_metadata?.role as string | undefined;

  // Role-based redirect for accounts created through the new system
  if (role === "admin") redirect("/admin");
  if (role === "owner") redirect("/dashboard");
  if (role === "employee") redirect("/check-in");

  // Fallback: DB check for legacy accounts without explicit role
  const [{ count: storeCount }, { data: employee }] = await Promise.all([
    supabase.from("stores").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    supabase.from("employees").select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
  ]);

  if (storeCount && storeCount > 0) redirect("/dashboard");
  if (employee) redirect("/check-in");

  redirect("/dashboard");
}
