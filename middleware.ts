import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet: { name: string; value: string; options: object }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const role = user?.user_metadata?.role as string | undefined;

  // ── Admin-only routes ──────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    if (role !== "admin") {
      if (role === "owner") return NextResponse.redirect(new URL("/dashboard", request.url));
      if (role === "employee") return NextResponse.redirect(new URL("/check-in", request.url));
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  // ── Owner/employee protected routes ───────────────────────────────────────
  const protectedPaths = ["/dashboard", "/check-in"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── Redirect admin away from owner/employee pages ─────────────────────────
  if (isProtected && role === "admin") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // ── Check owner is_active (suspended accounts) ────────────────────────────
  if (isProtected && role === "owner") {
    const { data: profile } = await supabase
      .from("owner_profiles")
      .select("is_active")
      .eq("user_id", user!.id)
      .maybeSingle();

    // Profile exists and is explicitly deactivated → suspend
    if (profile && !profile.is_active) {
      return NextResponse.redirect(new URL("/suspended", request.url));
    }
  }

  // ── Already logged in on /login ────────────────────────────────────────────
  if (pathname === "/login" && user) {
    if (role === "admin") return NextResponse.redirect(new URL("/admin", request.url));
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/check-in/:path*", "/check-in", "/login", "/suspended"],
};
