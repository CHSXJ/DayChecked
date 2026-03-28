"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient as createBrowserClient } from "@/lib/supabase-browser";
import PinPad from "@/components/PinPad";
import CheckInButton from "@/components/CheckInButton";
import ThemeToggle from "@/components/ThemeToggle";
import AppLogo from "@/components/AppLogo";
import { getCurrentPosition, haversineDistance } from "@/lib/gps";
import type { Store, EmployeePublic, AttendanceLog, CheckInResponse } from "@/lib/types";

type Step = "loading" | "gps" | "blocked" | "pin" | "success" | "error" | "no_record";

export default function CheckInPage() {
  const supabase = createBrowserClient();
  const [employee, setEmployee] = useState<EmployeePublic | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<Step>("loading");
  const [lastType, setLastType] = useState<"in" | "out" | null>(null);
  const [successLog, setSuccessLog] = useState<AttendanceLog | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [blockedMessage, setBlockedMessage] = useState("");
  const [distance, setDistance] = useState<number | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonConfirmed, setReasonConfirmed] = useState(false);

  const checkGps = useCallback(async (storeData: Store) => {
    setStep("gps");
    try {
      const position = await getCurrentPosition();
      const { latitude: lat, longitude: lng } = position.coords;
      const dist = haversineDistance(lat, lng, storeData.lat, storeData.lng);
      setDistance(Math.round(dist));
      if (dist > storeData.radius_meters) {
        setBlockedMessage(`อยู่นอกพื้นที่ ${Math.round(dist)} เมตร (อนุญาต ${storeData.radius_meters} เมตร)`);
        setStep("blocked");
      } else {
        setStep("pin");
      }
    } catch (err) {
      setBlockedMessage(err instanceof Error ? err.message : "ไม่สามารถระบุ GPS ได้");
      setStep("blocked");
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStep("no_record"); return; }
      const [{ count: ownedCount }, { count: coOwnedCount }] = await Promise.all([
        supabase.from("stores").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("store_owners").select("store_id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if ((ownedCount ?? 0) + (coOwnedCount ?? 0) > 0) setIsOwner(true);
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
      await checkGps(storeData);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePinComplete = async (p: string) => {
    setPin(p);
    setPinVerified(false);
    setPinError("");
    setVerifyingPin(true);
    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employee?.id, pin: p }),
      });
      const data = await res.json();
      if (data.valid) {
        setPinVerified(true);
      } else {
        setPinError("PIN ไม่ถูกต้อง กรุณาลองใหม่");
      }
    } catch {
      setPinError("ไม่สามารถตรวจสอบ PIN ได้");
    } finally {
      setVerifyingPin(false);
    }
  };
  const handleSuccess = (log: CheckInResponse["log"]) => { if (log) { setSuccessLog(log); setLastType(log.type); } setStep("success"); };
  const handleError = (msg: string) => { setErrorMessage(msg); setStep("error"); };
  const reset = () => { setPin(""); setPinVerified(false); setPinError(""); setReason(""); setReasonConfirmed(false); setStep("pin"); setErrorMessage(""); };
  const recheckLocation = () => { if (store) checkGps(store); };
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
        {(step === "loading") && (
          <div className="card-glass p-12 text-center animate-pulse" style={{ color: "var(--text-muted)" }}>
            กำลังโหลด...
          </div>
        )}

        {/* GPS checking */}
        {step === "gps" && (
          <div className="card-glass p-12 text-center space-y-3 animate-pulse">
            <svg className="w-8 h-8 mx-auto animate-spin" style={{ color: "var(--primary)" }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>กำลังตรวจสอบ GPS...</p>
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

        {/* Blocked — outside area or GPS error */}
        {step === "blocked" && employee && store && (
          <div className="space-y-4 animate-fade-up">
            {/* Employee card */}
            <div className="card-glass p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-base font-bold"
                style={{ background: "linear-gradient(135deg,#a3e635,#84cc16)", color: "#1a2e05" }}>
                {employee.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>{employee.name}</p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{store.name}</p>
              </div>
              <span className={lastType === "in" ? "badge-orange" : "badge-lime"}>
                {lastType === "in" ? "กำลังทำงาน" : "ยังไม่เข้างาน"}
              </span>
            </div>

            {/* Out of area notice */}
            <div className="card-glass px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "var(--danger-bg)" }}>
                <svg className="w-4 h-4" style={{ color: "var(--danger)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm" style={{ color: "var(--text)" }}>อยู่นอกพื้นที่</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--danger)" }}>{blockedMessage}</p>
              </div>
              <button onClick={recheckLocation}
                className="shrink-0 p-2 rounded-lg transition-colors"
                title="ตรวจสอบอีกครั้ง"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {/* Reason input */}
            {!reasonConfirmed ? (
              <div className="card-glass p-5 space-y-3">
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  ระบุเหตุผลเพื่อเข้า/ออกงานนอกพื้นที่
                </p>
                <textarea
                  rows={3}
                  placeholder="เช่น ไปส่งของนอกสถานที่, ประชุมนอกออฟฟิศ..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input-base w-full resize-none"
                />
                <button
                  onClick={() => setReasonConfirmed(true)}
                  disabled={!reason.trim()}
                  className="btn-lime w-full py-2.5"
                  style={!reason.trim() ? { opacity: 0.4, cursor: "not-allowed" } : {}}
                >
                  ดำเนินการต่อ
                </button>
              </div>
            ) : (
              <>
                {/* Reason confirmed — show PIN */}
                <div className="card-glass px-4 py-2.5 flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--accent-dark)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm flex-1" style={{ color: "var(--text-muted)" }}>{reason}</p>
                  <button onClick={() => { setReasonConfirmed(false); setPinVerified(false); setPin(""); setPinError(""); }}
                    className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                    แก้ไข
                  </button>
                </div>

                <div className="card-glass p-6 space-y-6">
                  <p className="text-center text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                    กรอก PIN 4 หลักเพื่อยืนยัน
                  </p>
                  <PinPad onComplete={handlePinComplete} disabled={verifyingPin} />
                  {verifyingPin && (
                    <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>กำลังตรวจสอบ PIN...</p>
                  )}
                  {pinError && !verifyingPin && (
                    <p className="text-center text-sm font-semibold" style={{ color: "var(--danger)" }}>{pinError}</p>
                  )}
                </div>

                {pinVerified && (
                  <div className="card-glass p-4">
                    <CheckInButton
                      employeeId={employee.id}
                      store={store}
                      pin={pin}
                      lastType={lastType}
                      onSuccess={handleSuccess}
                      onError={handleError}
                      reason={reason}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* In area — PIN + button */}
        {step === "pin" && employee && store && (
          <div className="space-y-4 animate-fade-up">
            {/* Employee card */}
            <div className="card-glass p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-base font-bold"
                style={{ background: "linear-gradient(135deg,#a3e635,#84cc16)", color: "#1a2e05" }}>
                {employee.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>{employee.name}</p>
                <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{store.name}</p>
              </div>
              <span className={lastType === "in" ? "badge-orange" : "badge-lime"}>
                {lastType === "in" ? "กำลังทำงาน" : "ยังไม่เข้างาน"}
              </span>
            </div>

            {/* Location badge */}
            <div className="card-glass px-4 py-2.5 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" style={{ color: "var(--primary-dark)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm font-semibold" style={{ color: "var(--primary-dark)" }}>
                อยู่ในพื้นที่
                {distance !== null && <span className="font-normal text-xs ml-1" style={{ color: "var(--text-muted)" }}>({distance} เมตรจากร้าน)</span>}
              </p>
            </div>

            {/* PIN card */}
            <div className="card-glass p-6 space-y-6">
              <p className="text-center text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                กรอก PIN 4 หลักเพื่อยืนยัน
              </p>
              <PinPad onComplete={handlePinComplete} disabled={verifyingPin} />
              {verifyingPin && (
                <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>กำลังตรวจสอบ PIN...</p>
              )}
              {pinError && !verifyingPin && (
                <p className="text-center text-sm font-semibold" style={{ color: "var(--danger)" }}>{pinError}</p>
              )}
            </div>

            {/* Action button — shown only after PIN verified */}
            {pinVerified && (
              <div className="card-glass p-4">
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
