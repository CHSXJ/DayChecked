"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@/lib/supabase-browser";
import ThemeToggle from "@/components/ThemeToggle";
import AppLogo from "@/components/AppLogo";
import type { Store, EmployeePublic } from "@/lib/types";

interface EditForm { name: string; lat: string; lng: string; radius_meters: string; }
interface OwnerEntry { user_id: string; email: string; name: string; is_primary: boolean; }

export default function StoreDetailPage() {
  const supabase = createBrowserClient();
  const params = useParams();
  const router = useRouter();
  const storeId = params.id as string;

  const [store, setStore] = useState<Store | null>(null);
  const [employees, setEmployees] = useState<EmployeePublic[]>([]);
  const [owners, setOwners] = useState<OwnerEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>({ name: "", lat: "", lng: "", radius_meters: "" });
  const [addOwnerEmail, setAddOwnerEmail] = useState("");
  const [addingOwner, setAddingOwner] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const loadOwners = async () => {
    const res = await fetch(`/api/store-owners?store_id=${storeId}`);
    if (res.ok) {
      const data = await res.json();
      setOwners(data.owners ?? []);
    }
  };

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setCurrentUserId(user.id);

      // Load store — must be primary owner OR co-owner
      const { data: storeRaw } = await supabase.from("stores").select("*").eq("id", storeId).maybeSingle();
      if (!storeRaw) { setNotFound(true); setLoading(false); return; }
      const s = storeRaw as Store;
      const isPrimary = s.owner_id === user.id;
      if (!isPrimary) {
        const { data: co } = await supabase.from("store_owners").select("store_id").eq("store_id", storeId).eq("user_id", user.id).maybeSingle();
        if (!co) { setNotFound(true); setLoading(false); return; }
      }
      setStore(s);

      const [{ data: empRaw }] = await Promise.all([
        supabase.from("employees").select("id, store_id, name, is_active, user_id, created_at").eq("store_id", storeId).order("created_at", { ascending: false }),
        loadOwners(),
      ]);

      setEmployees((empRaw ?? []) as EmployeePublic[]);
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const openEdit = () => {
    if (!store) return;
    setForm({ name: store.name, lat: String(store.lat), lng: String(store.lng), radius_meters: String(store.radius_meters) });
    setEditing(true);
  };

  const fillGps = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((p) => ({ ...p, lat: pos.coords.latitude.toFixed(8), lng: pos.coords.longitude.toFixed(8) })),
      () => showToast("ไม่สามารถดึง GPS ได้", false)
    );
  };

  const handleAddOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingOwner(true);
    const res = await fetch("/api/store-owners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store_id: storeId, email: addOwnerEmail }),
    });
    const data = await res.json();
    setAddingOwner(false);
    if (!res.ok) { showToast(data.error ?? "เพิ่มไม่สำเร็จ", false); return; }
    setAddOwnerEmail("");
    showToast("เพิ่มเจ้าของร้านร่วมสำเร็จ!");
    loadOwners();
  };

  const handleRemoveOwner = async (userId: string) => {
    if (!confirm("ลบเจ้าของร้านร่วมคนนี้?")) return;
    const res = await fetch(`/api/store-owners?store_id=${storeId}&user_id=${userId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { showToast(data.error ?? "ลบไม่สำเร็จ", false); return; }
    showToast("ลบเจ้าของร้านร่วมสำเร็จ!");
    loadOwners();
  };

  const handleToggleCoOwners = async (enabled: boolean) => {
    if (!store) return;
    const { error } = await supabase.from("stores").update({ allow_co_owners: enabled }).eq("id", store.id);
    if (error) { showToast("บันทึกการตั้งค่าไม่สำเร็จ", false); return; }
    setStore((prev) => prev ? { ...prev, allow_co_owners: enabled } : prev);
    showToast(enabled ? "เปิดใช้งานเจ้าของร้านร่วมแล้ว" : "ปิดใช้งานเจ้าของร้านร่วมแล้ว");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    setSaving(true);
    const { error } = await supabase.from("stores").update({
      name: form.name,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      radius_meters: parseInt(form.radius_meters, 10),
    }).eq("id", store.id);
    setSaving(false);
    if (error) { showToast("แก้ไขไม่สำเร็จ: " + error.message, false); return; }
    setStore((prev) => prev ? { ...prev, name: form.name, lat: parseFloat(form.lat), lng: parseFloat(form.lng), radius_meters: parseInt(form.radius_meters, 10) } : prev);
    setEditing(false);
    showToast("แก้ไขร้านสำเร็จ!");
  };

  const activeCount = employees.filter((e) => e.is_active).length;

  return (
    <main
      className="min-h-screen p-4 pt-8 pb-10 relative overflow-hidden"
      style={{ background: "var(--bg-gradient)" }}
    >
      {/* Decorative blobs */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #a3e635, transparent 70%)" }} />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #fb923c, transparent 70%)" }} />

      <div className="w-full max-w-lg mx-auto space-y-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="btn-ghost flex items-center gap-1.5 text-sm px-3 py-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            กลับ
          </button>
          <AppLogo iconSize={28} textSize={14} />
          <ThemeToggle />
        </div>

        {/* Toast */}
        {toast && (
          <div className="rounded-2xl px-4 py-3 text-sm flex items-center gap-2 font-medium animate-fade-up"
            style={toast.ok
              ? { background: "var(--primary-bg)", color: "var(--primary-dark)", border: "1px solid var(--primary)" }
              : { background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger)" }
            }>
            {toast.ok
              ? <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              : <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            }
            {toast.msg}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="card-glass p-12 text-center animate-pulse" style={{ color: "var(--text-muted)" }}>
            กำลังโหลด...
          </div>
        )}

        {/* Not found */}
        {!loading && notFound && (
          <div className="card-glass p-8 text-center space-y-3">
            <p className="text-lg font-bold" style={{ color: "var(--text)" }}>ไม่พบข้อมูลร้านค้า</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>ร้านนี้ไม่มีอยู่หรือคุณไม่มีสิทธิ์เข้าถึง</p>
            <button onClick={() => router.push("/dashboard")} className="btn-outlined">กลับ Dashboard</button>
          </div>
        )}

        {!loading && store && (
          <>
            {/* Store info card */}
            {!editing ? (
              <div className="card-glass p-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-lg font-extrabold"
                    style={{ background: "linear-gradient(135deg,#a3e635,#84cc16)", color: "#1a2e05" }}>
                    {store.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-extrabold truncate" style={{ color: "var(--text)" }}>{store.name}</h1>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      สร้างเมื่อ {new Date(store.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <button onClick={openEdit}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0"
                    style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--primary-dark)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
                  >
                    แก้ไข
                  </button>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl px-3 py-3 text-center" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <p className="text-xl font-extrabold leading-none" style={{ color: "var(--primary-dark)" }}>{activeCount}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>พนักงานปัจจุบัน</p>
                  </div>
                  <div className="rounded-xl px-3 py-3 text-center" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <p className="text-xl font-extrabold leading-none" style={{ color: "var(--text)" }}>{employees.length}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>ทั้งหมด</p>
                  </div>
                  <div className="rounded-xl px-3 py-3 text-center" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <p className="text-xl font-extrabold leading-none" style={{ color: "var(--accent-dark)" }}>{store.radius_meters} ม.</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>รัศมีพื้นที่</p>
                  </div>
                </div>

                {/* Co-owners toggle — primary owner only */}
                {store.owner_id === currentUserId && (
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm" style={{ color: "var(--text-muted)" }}>อนุญาตเจ้าของร้านร่วม</span>
                    </div>
                    <button
                      onClick={() => handleToggleCoOwners(!store.allow_co_owners)}
                      className="relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0"
                      style={{ background: store.allow_co_owners ? "var(--primary)" : "var(--border-strong)" }}
                    >
                      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                        style={{ left: store.allow_co_owners ? "calc(100% - 1.375rem)" : "0.125rem" }} />
                    </button>
                  </div>
                )}

                {/* Location row */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {store.lat.toFixed(8)}, {store.lng.toFixed(8)}
                    </span>
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${store.lat},${store.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{ background: "var(--surface-2)", color: "var(--primary-dark)", border: "1px solid var(--border)" }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Google Maps
                  </a>
                </div>
              </div>
            ) : (
              /* Edit form */
              <div className="card-glass p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-sm" style={{ color: "var(--text)" }}>แก้ไขข้อมูลร้าน</h2>
                  <button onClick={() => setEditing(false)}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ color: "var(--text-muted)" }}>
                    ยกเลิก
                  </button>
                </div>
                <form onSubmit={handleSave} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>ชื่อร้าน</label>
                    <input
                      required type="text" placeholder="ชื่อร้าน"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className="input-base"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>พิกัด GPS</label>
                    <div className="flex gap-2">
                      <input
                        required type="number" step="any" placeholder="Latitude"
                        value={form.lat}
                        onChange={(e) => setForm((p) => ({ ...p, lat: e.target.value }))}
                        className="input-base flex-1"
                      />
                      <input
                        required type="number" step="any" placeholder="Longitude"
                        value={form.lng}
                        onChange={(e) => setForm((p) => ({ ...p, lng: e.target.value }))}
                        className="input-base flex-1"
                      />
                      <button type="button" onClick={fillGps}
                        className="btn-outlined px-3 shrink-0" title="ดึง GPS ปัจจุบัน">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Radius (เมตร)</label>
                    <input
                      required type="number" placeholder="100"
                      value={form.radius_meters}
                      onChange={(e) => setForm((p) => ({ ...p, radius_meters: e.target.value }))}
                      className="input-base"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setEditing(false)}
                      className="btn-outlined flex-1 py-2.5">
                      ยกเลิก
                    </button>
                    <button type="submit" disabled={saving} className="btn-lime flex-1 py-2.5">
                      {saving ? "กำลังบันทึก..." : "บันทึก"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Owners section — only when co-owners enabled */}
            {store.allow_co_owners && <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest px-1" style={{ color: "var(--text-muted)" }}>
                เจ้าของร้าน ({owners.length})
              </p>

              {owners.map((o) => (
                <div key={o.user_id} className="card-glass px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{ background: o.is_primary ? "linear-gradient(135deg,#a3e635,#84cc16)" : "var(--surface-2)", color: o.is_primary ? "#1a2e05" : "var(--text-muted)" }}>
                    {(o.name || o.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>{o.name || "—"}</p>
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{o.email}</p>
                  </div>
                  {o.is_primary
                    ? <span className="badge-lime">เจ้าของหลัก</span>
                    : store?.owner_id === currentUserId && (
                        <button
                          onClick={() => handleRemoveOwner(o.user_id)}
                          className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                          style={{ color: "var(--danger)", border: "1px solid var(--danger)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--danger-bg)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          ลบ
                        </button>
                      )
                  }
                </div>
              ))}

              {/* Add co-owner form — primary owner only */}
              {store?.owner_id === currentUserId && (
                <form onSubmit={handleAddOwner} className="card-glass px-4 py-3 flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="อีเมลเจ้าของร้านร่วม"
                    value={addOwnerEmail}
                    onChange={(e) => setAddOwnerEmail(e.target.value)}
                    className="input-base flex-1 text-sm py-2"
                  />
                  <button type="submit" disabled={addingOwner} className="btn-lime px-4 py-2 text-sm shrink-0">
                    {addingOwner ? "..." : "เพิ่ม"}
                  </button>
                </form>
              )}
            </div>}

            {/* Employees list */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest px-1" style={{ color: "var(--text-muted)" }}>
                พนักงาน ({employees.length})
              </p>

              {employees.length === 0 && (
                <div className="card-glass p-8 text-center" style={{ color: "var(--text-muted)" }}>
                  ยังไม่มีพนักงานในร้านนี้
                </div>
              )}

              {employees.map((emp) => (
                <div key={emp.id} className="card-glass px-4 py-3 flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{
                      background: emp.is_active ? "linear-gradient(135deg,#a3e635,#84cc16)" : "var(--surface-2)",
                      color: emp.is_active ? "#1a2e05" : "var(--text-muted)",
                    }}
                  >
                    {emp.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>{emp.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      เพิ่มเมื่อ {new Date(emp.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {emp.user_id && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                      มีบัญชี
                    </span>
                  )}
                  <span className={emp.is_active ? "badge-lime" : "badge-orange"}>
                    {emp.is_active ? "ใช้งาน" : "ระงับ"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
