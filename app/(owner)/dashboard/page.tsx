"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient as createBrowserClient } from "@/lib/supabase-browser";
import AttendanceTable from "@/components/AttendanceTable";
import ThemeToggle from "@/components/ThemeToggle";
import AppLogo from "@/components/AppLogo";
import type { Store, EmployeePublic, AttendanceLogWithEmployee, OwnerProfile } from "@/lib/types";

type Tab = "stores" | "employees" | "logs";

interface NewStoreForm { name: string; lat: string; lng: string; radius_meters: string; }
interface NewEmployeeForm { name: string; pin: string; store_id: string; email: string; password: string; isSelf: boolean; }

export default function DashboardPage() {
  const supabase = createBrowserClient();

  const [tab, setTab] = useState<Tab>("stores");
  const [stores, setStores] = useState<Store[]>([]);
  const [employees, setEmployees] = useState<EmployeePublic[]>([]);
  const [logs, setLogs] = useState<AttendanceLogWithEmployee[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ownerIsEmployee, setOwnerIsEmployee] = useState(false);
  const [ownerProfile, setOwnerProfile] = useState<OwnerProfile | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [storeForm, setStoreForm] = useState<NewStoreForm>({ name: "", lat: "", lng: "", radius_meters: "100" });
  const [empForm, setEmpForm] = useState<NewEmployeeForm>({ name: "", pin: "", store_id: "", email: "", password: "", isSelf: false });
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [editStoreForm, setEditStoreForm] = useState<NewStoreForm>({ name: "", lat: "", lng: "", radius_meters: "100" });
  const [editingEmp, setEditingEmp] = useState<EmployeePublic | null>(null);
  const [editEmpForm, setEditEmpForm] = useState({ name: "", pin: "" });

  const showToast = (msg: string, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: profile } = await supabase
          .from("owner_profiles")
          .select("*")
          .eq("user_id", uid)
          .maybeSingle();
        setOwnerProfile(profile as OwnerProfile | null);
      }
    });
  }, [supabase]);

  const loadStores = useCallback(async () => {
    if (!userId) return;
    const [{ data: owned }, { data: coOwnedRows }] = await Promise.all([
      supabase.from("stores").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
      supabase.from("store_owners").select("store_id").eq("user_id", userId),
    ]);
    const coIds = (coOwnedRows ?? []).map((r) => r.store_id);
    let coOwned: typeof owned = [];
    if (coIds.length > 0) {
      const { data } = await supabase.from("stores").select("*").in("id", coIds).order("created_at", { ascending: false });
      coOwned = data ?? [];
    }
    const merged = [...(owned ?? []), ...coOwned.filter((s) => !(owned ?? []).some((o) => o.id === s.id))];
    setStores(merged as Store[]);
  }, [supabase, userId]);

  const loadEmployees = useCallback(async () => {
    if (!userId) return;
    const storeIds = stores.map((s) => s.id);
    if (storeIds.length === 0) { setEmployees([]); return; }
    const { data } = await supabase.from("employees").select("id, store_id, name, is_active, user_id, created_at").in("store_id", storeIds).order("created_at", { ascending: false });
    const list = (data ?? []) as (EmployeePublic & { user_id: string | null })[];
    setEmployees(list);
    setOwnerIsEmployee(list.some((e) => e.user_id === userId));
  }, [supabase, userId, stores]);

  const loadLogs = useCallback(async () => {
    if (!selectedStoreId || !selectedMonth) return;
    setLoading(true);
    const res = await fetch(`/api/attendance?store_id=${selectedStoreId}&month=${selectedMonth}`);
    const data = await res.json();
    setLogs(data.logs ?? []);
    setLoading(false);
  }, [selectedStoreId, selectedMonth]);

  useEffect(() => { loadStores(); }, [loadStores]);
  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) setSelectedStoreId(stores[0].id);
  }, [stores, selectedStoreId]);
  useEffect(() => { if (stores.length > 0) loadEmployees(); }, [stores, loadEmployees]);
  useEffect(() => { if (tab === "logs") loadLogs(); }, [tab, selectedStoreId, selectedMonth, loadLogs]);

  const fillCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setStoreForm((prev) => ({ ...prev, lat: pos.coords.latitude.toFixed(8), lng: pos.coords.longitude.toFixed(8) })),
      () => showToast("ไม่สามารถดึง GPS ได้", false)
    );
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    // Client-side limit check for immediate feedback
    if (ownerProfile && stores.length >= ownerProfile.max_stores) {
      showToast(`ถึงขีดจำกัดแล้ว (สูงสุด ${ownerProfile.max_stores} ร้าน)`, false);
      return;
    }

    setLoading(true);
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: storeForm.name,
        lat: parseFloat(storeForm.lat),
        lng: parseFloat(storeForm.lng),
        radius_meters: parseInt(storeForm.radius_meters, 10),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { showToast("สร้างร้านไม่สำเร็จ: " + (data.error ?? ""), false); }
    else { showToast("สร้างร้านสำเร็จ!"); setStoreForm({ name: "", lat: "", lng: "", radius_meters: "100" }); loadStores(); }
  };

  const handleDeleteStore = async (id: string) => {
    if (!confirm("ลบร้านนี้? พนักงานและ log ทั้งหมดจะถูกลบด้วย")) return;
    await supabase.from("stores").delete().eq("id", id);
    loadStores();
  };

  const openEditStore = (store: Store) => {
    setEditingStore(store);
    setEditStoreForm({ name: store.name, lat: String(store.lat), lng: String(store.lng), radius_meters: String(store.radius_meters) });
  };

  const fillEditLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setEditStoreForm((p) => ({ ...p, lat: pos.coords.latitude.toFixed(8), lng: pos.coords.longitude.toFixed(8) })),
      () => showToast("ไม่สามารถดึง GPS ได้", false)
    );
  };

  const handleUpdateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    setLoading(true);
    const { error } = await supabase.from("stores").update({
      name: editStoreForm.name,
      lat: parseFloat(editStoreForm.lat),
      lng: parseFloat(editStoreForm.lng),
      radius_meters: parseInt(editStoreForm.radius_meters, 10),
    }).eq("id", editingStore.id);
    setLoading(false);
    if (error) { showToast("แก้ไขไม่สำเร็จ: " + error.message, false); }
    else { showToast("แก้ไขร้านสำเร็จ!"); setEditingStore(null); loadStores(); }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(empForm.pin)) { showToast("PIN ต้องเป็นตัวเลข 4 หลัก", false); return; }
    setLoading(true);
    const payload = empForm.isSelf
      ? { store_id: empForm.store_id, name: empForm.name, pin: empForm.pin, self: true }
      : { store_id: empForm.store_id, name: empForm.name, pin: empForm.pin, email: empForm.email, password: empForm.password };
    const res = await fetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { showToast("เพิ่มพนักงานไม่สำเร็จ: " + (data.error ?? ""), false); }
    else { showToast("เพิ่มพนักงานสำเร็จ!"); setEmpForm({ name: "", pin: "", store_id: "", email: "", password: "", isSelf: false }); loadEmployees(); }
  };

  const handleToggleEmployee = async (id: string, current: boolean) => {
    await supabase.from("employees").update({ is_active: !current }).eq("id", id);
    loadEmployees();
  };

  const openEditEmp = (emp: EmployeePublic) => {
    setEditingEmp(emp);
    setEditEmpForm({ name: emp.name, pin: "" });
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;
    if (editEmpForm.pin && !/^\d{4}$/.test(editEmpForm.pin)) { showToast("PIN ต้องเป็นตัวเลข 4 หลัก", false); return; }
    setLoading(true);
    const res = await fetch("/api/employees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: editingEmp.id, name: editEmpForm.name || undefined, pin: editEmpForm.pin || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { showToast("แก้ไขไม่สำเร็จ: " + (data.error ?? ""), false); }
    else { showToast("แก้ไขพนักงานสำเร็จ!"); setEditingEmp(null); loadEmployees(); }
  };

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "stores",
      label: "ร้านของฉัน",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      key: "employees",
      label: "พนักงาน",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      key: "logs",
      label: "สรุปรายงาน",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  const navItem = (key: Tab, label: string, icon: React.ReactNode) => {
    const active = tab === key;
    return (
      <button
        key={key}
        onClick={() => { setTab(key); setSidebarOpen(false); }}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150"
        style={active
          ? { background: "var(--primary-bg)", color: "var(--primary-dark)" }
          : { color: "var(--text-muted)" }
        }
        onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)"; }}
        onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        <span style={{ color: active ? "var(--primary-dark)" : "var(--text-muted)" }}>{icon}</span>
        {label}
        {active && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "var(--primary)" }} />
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-gradient)" }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 lg:hidden"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen z-30 flex flex-col shrink-0 transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{
          width: "240px",
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 flex justify-center">
          <AppLogo iconSize={32} textSize={16} />
        </div>

        {/* Stats pills */}
        <div className="px-4 pb-4 flex gap-2">
          <div className="flex-1 rounded-xl py-2 text-center" style={{ background: "var(--primary-bg)" }}>
            <p className="text-lg font-extrabold leading-none" style={{ color: "var(--primary-dark)" }}>
              {stores.length}{ownerProfile ? `/${ownerProfile.max_stores}` : ""}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--primary-dark)", opacity: 0.7 }}>ร้าน</p>
          </div>
          <div className="flex-1 rounded-xl py-2 text-center" style={{ background: "var(--accent-bg)" }}>
            <p className="text-lg font-extrabold leading-none" style={{ color: "var(--accent-dark)" }}>
              {employees.length}{ownerProfile ? `/${ownerProfile.max_employees}` : ""}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--accent-dark)", opacity: 0.7 }}>พนักงาน</p>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 mb-3 h-px" style={{ background: "var(--border)" }} />

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {TABS.map(({ key, label, icon }) => navItem(key, label, icon))}
        </nav>

        {/* Divider */}
        <div className="mx-4 mt-3 h-px" style={{ background: "var(--border)" }} />

        {/* Bottom actions */}
        <div className="px-3 py-4 space-y-1">
          <a
            href="/check-in"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface-2)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            หน้าพนักงาน
          </a>
          <button
            onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/login"))}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150"
            style={{ color: "var(--danger)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--danger-bg)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 h-14"
          style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)" }}
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Page title */}
          <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
            {TABS.find((t) => t.key === tab)?.label}
          </p>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 p-4 sm:p-6 space-y-5">

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

          {/* ── STORES TAB ── */}
          {tab === "stores" && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Form */}
              <div className="lg:col-span-2 card-glass p-6 space-y-4 animate-fade-up">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "var(--primary-bg)" }}>
                    <svg className="w-4 h-4" style={{ color: "var(--primary-dark)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <h2 className="font-bold text-sm" style={{ color: "var(--text)" }}>เพิ่มร้านใหม่</h2>
                </div>
                <form onSubmit={handleCreateStore} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>ชื่อร้าน</label>
                    <input required type="text" placeholder="เช่น ร้านกาแฟ สาขาสยาม"
                      value={storeForm.name}
                      onChange={(e) => setStoreForm((p) => ({ ...p, name: e.target.value }))}
                      className="input-base" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>พิกัด GPS</label>
                    <div className="flex gap-2">
                      <input required type="number" step="any" placeholder="Latitude"
                        value={storeForm.lat}
                        onChange={(e) => setStoreForm((p) => ({ ...p, lat: e.target.value }))}
                        className="input-base flex-1" />
                      <input required type="number" step="any" placeholder="Longitude"
                        value={storeForm.lng}
                        onChange={(e) => setStoreForm((p) => ({ ...p, lng: e.target.value }))}
                        className="input-base flex-1" />
                      <button type="button" onClick={fillCurrentLocation}
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
                    <input required type="number" placeholder="100"
                      value={storeForm.radius_meters}
                      onChange={(e) => setStoreForm((p) => ({ ...p, radius_meters: e.target.value }))}
                      className="input-base" />
                  </div>
                  <button type="submit" disabled={loading} className="btn-lime w-full py-3">
                    {loading ? "กำลังบันทึก..." : "สร้างร้าน"}
                  </button>
                </form>
              </div>

              {/* Store list */}
              <div className="lg:col-span-3 card-glass overflow-hidden animate-fade-up">
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                  <h2 className="font-bold text-sm" style={{ color: "var(--text)" }}>ร้านทั้งหมด</h2>
                  <span className="badge-lime">{stores.length} ร้าน</span>
                </div>
                {stores.length === 0 ? (
                  <div className="px-5 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>ยังไม่มีร้าน</div>
                ) : (
                  <ul>
                    {stores.map((store) => (
                      <li key={store.id}
                        className="px-5 py-4 flex items-center justify-between transition-colors"
                        style={{ borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <a href={`/dashboard/stores/${store.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: "linear-gradient(135deg,#a3e635,#84cc16)" }}>
                            <svg className="w-5 h-5" style={{ color: "#1a2e05" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate" style={{ color: "var(--text)" }}>{store.name}</p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                              {store.lat.toFixed(8)}, {store.lng.toFixed(8)} · {store.radius_meters}m
                            </p>
                          </div>
                        </a>
                          <div className="flex items-center gap-1">
                          <button onClick={() => openEditStore(store)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            style={{ color: "var(--primary-dark)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--primary-bg)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            แก้ไข
                          </button>
                          <button onClick={() => handleDeleteStore(store.id)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            style={{ color: "var(--danger)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--danger-bg)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            ลบ
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* ── EMPLOYEES TAB ── */}
          {tab === "employees" && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Form */}
              <div className="lg:col-span-2 card-glass p-6 space-y-4 animate-fade-up">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "var(--accent-bg)" }}>
                    <svg className="w-4 h-4" style={{ color: "var(--accent-dark)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <h2 className="font-bold text-sm" style={{ color: "var(--text)" }}>เพิ่มพนักงาน</h2>
                </div>
                <form onSubmit={handleCreateEmployee} className="space-y-3">
                  {/* Self toggle — hidden if owner already has an employee record */}
                  {!ownerIsEmployee && <button
                    type="button"
                    onClick={() => setEmpForm((p) => ({ ...p, isSelf: !p.isSelf }))}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
                    style={empForm.isSelf
                      ? { background: "var(--primary-bg)", color: "var(--primary-dark)", border: "1px solid var(--primary)" }
                      : { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }
                    }
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    ใช้บัญชีของฉัน (เจ้าของร้าน)
                    <span className="ml-auto">
                      <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                        style={{ borderColor: empForm.isSelf ? "var(--primary-dark)" : "var(--text-muted)" }}>
                        {empForm.isSelf && <span className="w-2 h-2 rounded-full" style={{ background: "var(--primary-dark)" }} />}
                      </span>
                    </span>
                  </button>}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>สังกัดร้าน</label>
                    <select required value={empForm.store_id}
                      onChange={(e) => setEmpForm((p) => ({ ...p, store_id: e.target.value }))}
                      className="input-base">
                      <option value="">— เลือกร้าน —</option>
                      {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>ชื่อพนักงาน</label>
                    <input required type="text" placeholder="ชื่อ-นามสกุล"
                      value={empForm.name}
                      onChange={(e) => setEmpForm((p) => ({ ...p, name: e.target.value }))}
                      className="input-base" />
                  </div>
                  {!empForm.isSelf && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>อีเมล (สำหรับ login)</label>
                        <input required type="email" placeholder="employee@example.com"
                          value={empForm.email}
                          onChange={(e) => setEmpForm((p) => ({ ...p, email: e.target.value }))}
                          className="input-base" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>รหัสผ่าน (อย่างน้อย 6 ตัว)</label>
                        <input required type="password" placeholder="••••••"
                          value={empForm.password}
                          onChange={(e) => setEmpForm((p) => ({ ...p, password: e.target.value }))}
                          className="input-base" />
                      </div>
                    </>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>PIN 4 หลัก (สำหรับเช็คอิน)</label>
                    <input required type="password" placeholder="••••" maxLength={4}
                      value={empForm.pin}
                      onChange={(e) => setEmpForm((p) => ({ ...p, pin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                      className="input-base" />
                  </div>
                  <button type="submit" disabled={loading} className="btn-orange w-full py-3">
                    {loading ? "กำลังบันทึก..." : "เพิ่มพนักงาน"}
                  </button>
                </form>
              </div>

              {/* Employee list */}
              <div className="lg:col-span-3 card-glass overflow-hidden animate-fade-up">
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                  <h2 className="font-bold text-sm" style={{ color: "var(--text)" }}>พนักงานทั้งหมด</h2>
                  <span className="badge-orange">{employees.length} คน</span>
                </div>
                {employees.length === 0 ? (
                  <div className="px-5 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>ยังไม่มีพนักงาน</div>
                ) : (
                  <ul>
                    {employees.map((emp) => (
                      <li key={emp.id}
                        className="px-5 py-3.5 flex items-center justify-between transition-colors"
                        style={{ borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                            style={{ background: "linear-gradient(135deg,#fb923c,#f97316)", color: "#fff" }}>
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{emp.name}</p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {stores.find((s) => s.id === emp.store_id)?.name ?? "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditEmp(emp)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                            style={{ color: "var(--primary-dark)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--primary-bg)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            แก้ไข
                          </button>
                          <button onClick={() => handleToggleEmployee(emp.id, emp.is_active)}
                            className="cursor-pointer transition-opacity hover:opacity-75">
                            <span className={emp.is_active ? "badge-lime" : "badge-orange"}>
                              {emp.is_active ? "ใช้งานอยู่" : "ระงับแล้ว"}
                            </span>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* ── LOGS TAB ── */}
          {tab === "logs" && (
            <div className="space-y-5 animate-fade-up">
              <div className="card-glass p-4">
                <div className="flex gap-3 flex-wrap">
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="input-base flex-1 min-w-[180px]"
                  >
                    <option value="">— เลือกร้าน —</option>
                    {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="input-base w-auto"
                  />
                </div>
              </div>

              {!selectedStoreId && (
                <div className="card-glass px-5 py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  กรุณาเลือกร้านก่อน
                </div>
              )}

              {loading && (
                <div className="card-glass px-5 py-12 text-center text-sm animate-pulse" style={{ color: "var(--text-muted)" }}>
                  กำลังโหลด...
                </div>
              )}

              {selectedStoreId && !loading && (
                <div className="card-glass p-6">
                  <AttendanceTable logs={logs} month={selectedMonth} />
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Edit Store Modal */}
      {editingStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingStore(null); }}>
          <div className="card-glass w-full max-w-md p-6 space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm" style={{ color: "var(--text)" }}>แก้ไขข้อมูลร้าน</h2>
              <button onClick={() => setEditingStore(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUpdateStore} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>ชื่อร้าน</label>
                <input required type="text"
                  value={editStoreForm.name}
                  onChange={(e) => setEditStoreForm((p) => ({ ...p, name: e.target.value }))}
                  className="input-base" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>พิกัด GPS</label>
                <div className="flex gap-2">
                  <input required type="number" step="any" placeholder="Latitude"
                    value={editStoreForm.lat}
                    onChange={(e) => setEditStoreForm((p) => ({ ...p, lat: e.target.value }))}
                    className="input-base flex-1" />
                  <input required type="number" step="any" placeholder="Longitude"
                    value={editStoreForm.lng}
                    onChange={(e) => setEditStoreForm((p) => ({ ...p, lng: e.target.value }))}
                    className="input-base flex-1" />
                  <button type="button" onClick={fillEditLocation}
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
                <input required type="number"
                  value={editStoreForm.radius_meters}
                  onChange={(e) => setEditStoreForm((p) => ({ ...p, radius_meters: e.target.value }))}
                  className="input-base" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditingStore(null)}
                  className="btn-outlined flex-1 py-2.5">ยกเลิก</button>
                <button type="submit" disabled={loading} className="btn-lime flex-1 py-2.5">
                  {loading ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Employee Modal */}
      {editingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingEmp(null); }}>
          <div className="card-glass w-full max-w-sm p-6 space-y-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm" style={{ color: "var(--text)" }}>แก้ไขข้อมูลพนักงาน</h2>
              <button onClick={() => setEditingEmp(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUpdateEmployee} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>ชื่อพนักงาน</label>
                <input required type="text"
                  value={editEmpForm.name}
                  onChange={(e) => setEditEmpForm((p) => ({ ...p, name: e.target.value }))}
                  className="input-base" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>PIN ใหม่ (เว้นว่างถ้าไม่เปลี่ยน)</label>
                <input type="password" placeholder="••••" maxLength={4}
                  value={editEmpForm.pin}
                  onChange={(e) => setEditEmpForm((p) => ({ ...p, pin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  className="input-base" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditingEmp(null)}
                  className="btn-outlined flex-1 py-2.5">ยกเลิก</button>
                <button type="submit" disabled={loading} className="btn-orange flex-1 py-2.5">
                  {loading ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
