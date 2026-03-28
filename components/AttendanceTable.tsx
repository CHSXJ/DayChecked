"use client";

import { useMemo, useState } from "react";
import type { AttendanceLogWithEmployee } from "@/lib/types";

interface DayEntry {
  date: string; // YYYY-MM-DD
  minutes: number;
  autoCheckout: boolean;
}

interface EmpSummary {
  employee_id: string;
  employee_name: string;
  total_days: number;
  total_hours: number;
  daily: DayEntry[];
}

function endOfDay(dt: Date): Date {
  const d = new Date(dt);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isoDate(dt: Date): string {
  return dt.toISOString().split("T")[0];
}

function buildSummary(logs: AttendanceLogWithEmployee[]): EmpSummary[] {
  const byEmployee: Record<string, { name: string; logs: AttendanceLogWithEmployee[] }> = {};
  for (const log of logs) {
    if (!byEmployee[log.employee_id]) {
      byEmployee[log.employee_id] = { name: log.employees?.name ?? "ไม่ทราบชื่อ", logs: [] };
    }
    byEmployee[log.employee_id].logs.push(log);
  }

  return Object.entries(byEmployee).map(([employee_id, { name, logs: empLogs }]) => {
    const sorted = [...empLogs].sort(
      (a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
    );

    const dayMap: Record<string, { minutes: number; autoCheckout: boolean }> = {};

    const addMinutes = (date: string, minutes: number, autoCheckout: boolean) => {
      if (!dayMap[date]) dayMap[date] = { minutes: 0, autoCheckout: false };
      dayMap[date].minutes += minutes;
      if (autoCheckout) dayMap[date].autoCheckout = true;
    };

    let lastIn: Date | null = null;

    for (const log of sorted) {
      const dt = new Date(log.checked_at);
      if (log.type === "in") {
        // ถ้ามี check-in ค้างอยู่ (ไม่มี check-out) → auto-checkout เที่ยงคืน
        if (lastIn !== null) {
          addMinutes(isoDate(lastIn), (endOfDay(lastIn).getTime() - lastIn.getTime()) / 60000, true);
        }
        lastIn = dt;
      } else if (log.type === "out" && lastIn !== null) {
        const inDate = isoDate(lastIn);
        const outDate = isoDate(dt);
        if (inDate !== outDate) {
          // ข้ามวัน → นับถึงแค่ 23:59:59 ของวัน check-in
          addMinutes(inDate, (endOfDay(lastIn).getTime() - lastIn.getTime()) / 60000, true);
        } else {
          addMinutes(inDate, (dt.getTime() - lastIn.getTime()) / 60000, false);
        }
        lastIn = null;
      }
    }

    // check-in ค้างจากวันก่อน (ยังไม่ได้ออก และข้ามวันแล้ว)
    if (lastIn !== null && isoDate(lastIn) < isoDate(new Date())) {
      addMinutes(isoDate(lastIn), (endOfDay(lastIn).getTime() - lastIn.getTime()) / 60000, true);
    }

    const daily: DayEntry[] = Object.entries(dayMap)
      .map(([date, { minutes, autoCheckout }]) => ({ date, minutes, autoCheckout }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalMinutes = daily.reduce((sum, d) => sum + d.minutes, 0);

    return {
      employee_id,
      employee_name: name,
      total_days: daily.length,
      total_hours: Math.round((totalMinutes / 60) * 10) / 10,
      daily,
    };
  });
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} นาที`;
  if (m === 0) return `${h} ชม.`;
  return `${h} ชม. ${m} นาที`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
}

export default function AttendanceTable({ logs, month }: { logs: AttendanceLogWithEmployee[]; month: string }) {
  const summary = useMemo(() => buildSummary(logs), [logs]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-8">

      {/* Summary cards */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
          สรุปเดือน {month}
        </p>
        {summary.length === 0 && (
          <p className="text-sm py-4" style={{ color: "var(--text-muted)" }}>ไม่มีข้อมูลในเดือนนี้</p>
        )}
        <div className="space-y-3">
          {summary.map((emp) => {
            const isOpen = expandedId === emp.employee_id;
            return (
              <div key={emp.employee_id} className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid var(--border)" }}>

                {/* Card header */}
                <button
                  className="w-full flex items-center gap-3 p-4 transition-colors text-left"
                  style={{ background: "var(--surface-2)" }}
                  onClick={() => setExpandedId(isOpen ? null : emp.employee_id)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{ background: "linear-gradient(135deg,#a3e635,#84cc16)", color: "#1a2e05" }}>
                    {emp.employee_name.charAt(0)}
                  </div>
                  <p className="font-bold text-sm flex-1" style={{ color: "var(--text)" }}>{emp.employee_name}</p>

                  {/* Stats inline */}
                  <div className="flex items-center gap-4 mr-2">
                    <div className="text-center">
                      <p className="text-lg font-extrabold leading-none" style={{ color: "var(--primary-dark)" }}>{emp.total_days}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>วัน</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-extrabold leading-none" style={{ color: "var(--accent-dark)" }}>{emp.total_hours}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>ชม.</p>
                    </div>
                  </div>

                  {/* Chevron */}
                  <svg className="w-4 h-4 shrink-0 transition-transform" style={{ color: "var(--text-muted)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Daily breakdown */}
                {isOpen && (
                  <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
                    {emp.daily.length === 0 ? (
                      <p className="px-5 py-4 text-sm" style={{ color: "var(--text-muted)" }}>ไม่มีข้อมูล</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                            <th className="px-5 py-2.5 text-left text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>วัน</th>
                            <th className="px-5 py-2.5 text-right text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>ชั่วโมงทำงาน</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emp.daily.map(({ date, minutes, autoCheckout }) => (
                            <tr key={date} style={{ borderBottom: "1px solid var(--border)" }}>
                              <td className="px-5 py-3 font-medium" style={{ color: "var(--text)" }}>
                                {formatDate(date)}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <span style={{ color: "var(--accent-dark)" }}>{formatHours(minutes)}</span>
                                {autoCheckout && (
                                  <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                                    (ออกอัตโนมัติ)
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {/* Total row */}
                          <tr style={{ background: "var(--surface-2)" }}>
                            <td className="px-5 py-3 font-bold text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>รวม</td>
                            <td className="px-5 py-3 text-right font-extrabold" style={{ color: "var(--primary-dark)" }}>
                              {formatHours(emp.daily.reduce((s, d) => s + d.minutes, 0))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Raw log table */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>
          บันทึกทั้งหมด
        </p>
        <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                {["พนักงาน", "ประเภท", "เวลา", "GPS"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody style={{ background: "var(--surface)" }}>
              {logs.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>ไม่มีข้อมูล</td></tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="transition-colors" style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface)")}>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--text)" }}>{log.employees?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={log.type === "in" ? "badge-lime" : "badge-orange"}>
                      {log.type === "in" ? "เข้างาน" : "ออกงาน"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text-muted)" }}>{formatTime(log.checked_at)}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://www.google.com/maps?q=${log.lat},${log.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 w-fit"
                      title="ดูบน Google Maps"
                    >
                      <span className="text-xs font-semibold"
                        style={{ color: log.is_valid_location ? "var(--primary-dark)" : "var(--danger)" }}>
                        {log.is_valid_location ? "✓ ในพื้นที่" : "✗ นอกพื้นที่"}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {log.lat.toFixed(8)}, {log.lng.toFixed(8)}
                      </span>
                      {log.reason && (
                        <span className="text-xs italic" style={{ color: "var(--text-muted)" }} title={log.reason}>
                          "{log.reason.length > 30 ? log.reason.slice(0, 30) + "…" : log.reason}"
                        </span>
                      )}
                      <svg className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
