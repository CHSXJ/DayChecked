"use client";

import { useState } from "react";
import { createClient as createBrowserClient } from "@/lib/supabase-browser";
import ThemeToggle from "@/components/ThemeToggle";
import AppLogo from "@/components/AppLogo";

export default function LoginPage() {
  const supabase = createBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: authError } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) { setError(authError.message); }
    else { window.location.href = "/"; }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "var(--bg-gradient)" }}
    >
      {/* Decorative blobs */}
      <div
        className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(163,230,53,0.35) 0%, transparent 65%)",
          filter: "blur(48px)",
        }}
      />
      <div
        className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(251,146,60,0.25) 0%, transparent 65%)",
          filter: "blur(48px)",
        }}
      />

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[420px] relative animate-fade-up">

        {/* Header */}
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="inline-flex justify-center mb-5"
            style={{ filter: "drop-shadow(0 8px 20px rgba(249,115,22,0.35))" }}>
            <AppLogo iconSize={64} textSize={26} />
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight mb-2" style={{ color: "var(--text)" }}>
            {isSignUp ? "สมัครสมาชิก" : "ยินดีต้อนรับ"}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {isSignUp
              ? "สร้างบัญชีสำหรับเจ้าของร้านใหม่"
              : "เข้าสู่ระบบเพื่อจัดการร้านของคุณ"}
          </p>
        </div>

        {/* Card */}
        <div className="card-glass p-8 space-y-6">

          {/* Error */}
          {error && (
            <div
              className="rounded-2xl px-4 py-3 text-sm flex items-start gap-3"
              style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger)" }}
            >
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <label
                className="block text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}
              >
                อีเมล
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                  <svg className="w-4 h-4" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  required
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-base"
                  style={{ paddingLeft: "40px" }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label
                className="block text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}
              >
                รหัสผ่าน
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                  <svg className="w-4 h-4" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base"
                  style={{ paddingLeft: "40px" }}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-lime w-full py-4 text-base mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  กำลังดำเนินการ...
                </span>
              ) : isSignUp ? "สร้างบัญชี" : "เข้าสู่ระบบ"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-xs font-medium px-1" style={{ color: "var(--text-muted)" }}>หรือ</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>

          {/* Switch mode */}
          <div className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
            {isSignUp ? "มีบัญชีแล้ว? " : "ยังไม่มีบัญชี? "}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
              className="font-bold hover:underline underline-offset-2"
              style={{ color: "var(--primary-dark)" }}
            >
              {isSignUp ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
          DayChecked · ระบบลงชื่อเข้างานพนักงาน
        </p>
      </div>
    </main>
  );
}
