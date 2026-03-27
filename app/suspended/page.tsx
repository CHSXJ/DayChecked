"use client";

import { createClient } from "@/lib/supabase-browser";
import AppLogo from "@/components/AppLogo";
import ThemeToggle from "@/components/ThemeToggle";

export default function SuspendedPage() {
  const supabase = createClient();
  const signOut = () => supabase.auth.signOut().then(() => (window.location.href = "/login"));

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "var(--bg-gradient)" }}
    >
      <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(251,146,60,0.25) 0%, transparent 65%)", filter: "blur(48px)" }} />
      <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 65%)", filter: "blur(48px)" }} />

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[400px] text-center space-y-6 animate-fade-up">
        <div className="inline-flex justify-center mb-2">
          <AppLogo iconSize={48} textSize={20} />
        </div>

        <div className="card-glass p-8 space-y-5">
          <div className="inline-flex w-16 h-16 rounded-full items-center justify-center mx-auto"
            style={{ background: "var(--danger-bg)" }}>
            <svg className="w-8 h-8" style={{ color: "var(--danger)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>

          <div>
            <h1 className="text-xl font-extrabold" style={{ color: "var(--text)" }}>บัญชีถูกระงับ</h1>
            <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
              บัญชีของคุณถูกระงับการใช้งานชั่วคราว<br />
              กรุณาติดต่อผู้ดูแลระบบเพื่อดำเนินการต่อ
            </p>
          </div>

          <button onClick={signOut} className="btn-outlined w-full py-3">
            ออกจากระบบ
          </button>
        </div>
      </div>
    </main>
  );
}
