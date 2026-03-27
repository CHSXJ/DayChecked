"use client";

import { useEffect, useState } from "react";
import { createClient as createBrowserClient } from "@/lib/supabase-browser";
import PinPad from "@/components/PinPad";
import CheckInButton from "@/components/CheckInButton";
import ThemeToggle from "@/components/ThemeToggle";
import AppLogo from "@/components/AppLogo";
import type { Store, EmployeePublic, AttendanceLog, CheckInResponse } from "@/lib/types";

type Step = "loading" | "pin" | "confirm" | "success" | "error" | "no_record";

export default function CheckInPage() {
  const supabase = createBrowserClient();
  const [employee, setEmployee] = useState<EmployeePublic | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<Step>("loading");
  const [lastType, setLastType] = useState<"in" | "out" | null>(null);
  const [successLog, setSuccessLog] = useState<AttendanceLog | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStep("no_record"); return; }
      const { count } = await supabase.from("stores").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
      if (count && count > 0) setIsOwner(true);
      const { data: empRaw } = await supabase.from("employees").select("id, store_id, name, is_active, user_id, created_at").eq("user_id", user.id).eq("is_active", true).maybeSingle();
      const emp = empRaw as EmployeePublic | null;
      if (!emp) { setStep("no_record"); return; }
      setEmployee(emp);
      const { data: storeRaw } = await supabase.from("stores").select("*").eq("id", emp.store_id).single();
      const storeData = storeRaw as import("@/lib/types").Store | null;
      if (!storeData) { setStep("no_record"); return; }
      setStore(storeData);
      const { data: lastLogRaw } = await supabase.from("attendance_logs").select("type").eq("employee_id", emp.id).order("checked_at", { ascending: false }).limit(1).maybeSingle();
      const lastLog = lastLogRaw as { type: "in" | "out" } | null;
      setLastType(lastLog?.type ?? null);
      setStep("pin");
    };
    load();
  }, [supabase]);

  const handlePinComplete = (p: string) => { setPin(p); setStep("confirm"); };
  const handleSuccess = (log: CheckInResponse["log"]) => { if (log) { setSuccessLog(log); setLastType(log.type); } setStep("success"); };
  const handleError = (msg: string) => { setErrorMessage(msg); setStep("error"); };
  const reset = () => { setPin(""); setStep("pin"); setErrorMessage(""); };
  const signOut = () => supabase.auth.signOut().then(() => (window.location.href = "/login"));
  const formatTime = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

  return (
    <main className="min-h-screen flex flex-col items-center justify-start p-4 pt-8 pb-10 relative overflow-hidden"
      style={{ background: "var(--bg-gradient)" }}>

      {/* Decorative blobs */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #a3e635, transparent 70%)" }} />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #fb923c, transparent 70%)" }} />

      <div className="w-full max-w-sm space-y-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between">
          <AppLogo iconSize={32} textSize={16} />
          <div className="flex items-center gap-2">
            {isOwner && (
              <a href="/dashboard" className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5"
                style={{ color: "var(--primary-dark)" }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </a>
            )}
            <ThemeToggle />
            <button onClick={signOut} className="theme-toggle" title="ออกจากระบบ"
              style={{ color: "var(--danger)" }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Loading */}
        {step === "loading" && (
          <div className="card-glass p-12 text-center animate-pulse" style={{ color: "var(--text-muted)" }}>
            กำลังโหลด...
          </div>
        )}

        {/* No record */}
        {step === "no_record" && (
          <div className="card-glass p-8 text-center space-y-4 animate-fade-up">
            <div className="inline-flex w-16 h-16 rounded-full items-center justify-center mx-auto"
              style={{ background: "var(--accent-bg)" }}>
              <svg className="w-8 h-8" style={{ color: "var(--accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-lg font-bold" style={{ color: "var(--text)" }}>ไม่พบข้อมูลพนักงาน</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>บัญชีนี้ยังไม่ได้เชื่อมกับข้อมูลพนักงาน กรุณาติดต่อเจ้าของร้าน</p>
            <button onClick={signOut} className="btn-outlined">ออกจากระบบ</button>
          </div>
        )}

        {/* Employee info + PIN */}
        {(step === "pin" || step === "confirm") && employee && store && (
          <>
            {/* Employee card */}
            <div className="card-glass p-4 flex items-center gap-3 animate-fade-up">
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-base font-bold"
                style={{ background: "linear-gradient(135deg,#a3e635,#84cc16)", color: "#1a2e05" }}>
                {employee.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>{employee.name}</p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{store.name}</p>
              </div>
              <span className={lastType === "in" ? "badge-orange" : "badge-lime"}>
                {lastType === "in" ? "กำลังทำงาน" : "นอกงาน"}
              </span>
            </div>

            {/* PIN card */}
            <div className="card-glass p-6 space-y-6 animate-fade-up">
              <p className="text-center text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                กรอก PIN 4 หลักเพื่อยืนยัน
              </p>
              <PinPad onComplete={handlePinComplete} disabled={step === "confirm"} />
            </div>
          </>
        )}

        {/* Action button */}
        {step === "confirm" && employee && store && (
          <div className="card-glass p-4 animate-fade-up">
            <CheckInButton
              employeeId={employee.id}
              store={store}
              pin={pin}
              lastType={lastType}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          </div>
        )}

        {/* Success */}
        {step === "success" && successLog && (
          <div className="card-glass p-8 text-center space-y-5 animate-fade-up">
            <div className="inline-flex w-20 h-20 rounded-full items-center justify-center mx-auto"
              style={{ background: "linear-gradient(135deg,#a3e635,#84cc16)", boxShadow: "0 8px 32px rgba(132,204,22,0.4)" }}>
              <svg className="w-10 h-10" style={{ color: "#1a2e05" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-extrabold" style={{ color: "var(--text)" }}>
                {successLog.type === "in" ? "เช็คอินสำเร็จ! 🎉" : "เช็คเอาท์สำเร็จ! 👋"}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{formatTime(successLog.checked_at)}</p>
            </div>
            <button onClick={reset} className="btn-primary px-10">กลับหน้าหลัก</button>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div className="card-glass p-8 text-center space-y-5 animate-fade-up">
            <div className="inline-flex w-20 h-20 rounded-full items-center justify-center mx-auto"
              style={{ background: "var(--danger-bg)" }}>
              <svg className="w-10 h-10" style={{ color: "var(--danger)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-extrabold" style={{ color: "var(--text)" }}>เกิดข้อผิดพลาด</p>
              <p className="text-sm mt-1" style={{ color: "var(--danger)" }}>{errorMessage}</p>
            </div>
            <button onClick={reset} className="btn-outlined">ลองใหม่</button>
          </div>
        )}
      </div>
    </main>
  );
}
