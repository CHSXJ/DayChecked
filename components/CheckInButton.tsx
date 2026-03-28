"use client";

import { useState, useRef } from "react";
import { getCurrentPosition, haversineDistance } from "@/lib/gps";
import type { Store, CheckInRequest, CheckInResponse } from "@/lib/types";

interface CheckInButtonProps {
  employeeId: string;
  store: Store;
  pin: string;
  lastType: "in" | "out" | null;
  onSuccess: (log: CheckInResponse["log"]) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  reason?: string;
}

export default function CheckInButton({ employeeId, store, pin, lastType, onSuccess, onError, disabled = false, reason }: CheckInButtonProps) {
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const isCheckIn = lastType !== "in";

  const handleClick = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    try {
      let position: GeolocationPosition;
      try { position = await getCurrentPosition(); }
      catch (err) { onError(err instanceof Error ? err.message : "ไม่สามารถระบุ GPS ได้"); return; }

      const { latitude: lat, longitude: lng } = position.coords;
      if (!reason) {
        const distance = haversineDistance(lat, lng, store.lat, store.lng);
        if (distance > store.radius_meters) {
          onError(`อยู่นอกพื้นที่ ${Math.round(distance)} เมตร (อนุญาต ${store.radius_meters} เมตร)`);
          return;
        }
      }

      const body: CheckInRequest = { employee_id: employeeId, store_id: store.id, type: isCheckIn ? "in" : "out", lat, lng, pin, reason };
      const res = await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data: CheckInResponse = await res.json();
      if (!res.ok || !data.success) { onError(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่"); return; }
      onSuccess(data.log);
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const isDisabled = loading || !pin || disabled;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`w-full py-4 text-base font-bold transition-all duration-150 active:scale-95 rounded-full ${
        isDisabled ? "opacity-40 cursor-not-allowed" : ""
      } ${isCheckIn ? "btn-lime" : "btn-orange"}`}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          กำลังตรวจสอบ GPS...
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          {isCheckIn ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          )}
          {isCheckIn ? "เช็คอิน — เข้างาน" : "เช็คเอาท์ — ออกงาน"}
        </span>
      )}
    </button>
  );
}
