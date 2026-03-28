"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient as createBrowserClient } from "@/lib/supabase-browser";
import ThemeToggle from "@/components/ThemeToggle";
import AppLogo from "@/components/AppLogo";

// ── Types ──────────────────────────────────────────────────────────────────────

interface OwnerData {
  id: string;
  email: string;
  name: string;
  store_count: number;
  created_at: string;
  max_stores: number | null;
  max_employees: number | null;
  is_active: boolean | null;
}

interface StoreData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_meters: number;
  owner_id: string;
  owner_email: string;
  owner_name: string;
  employee_count: number;
  created_at: string;
}

interface EmployeeData {
  id: string;
  store_id: string;
  name: string;
  is_active: boolean;
  user_id: string | null;
  created_at: string;
}

type Tab = "owners" | "stores" | "employees";

// ── Default form states ────────────────────────────────────────────────────────

const defaultOwnerForm = { name: "", email: "", password: "", max_stores: "1", max_employees: "10" };
const defaultStoreForm = { name: "", owner_id: "", lat: "", lng: "", radius_meters: "100" };
const defaultEmpForm = { name: "", pin: "", store_id: "", email: "", password: "" };

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const supabase = createBrowserClient();

  const [tab, setTab] = useState<Tab>("owners");

  // Data
  const [owners, setOwners] = useState<OwnerData[]>([]);
  const [stores, setStores] = useState<StoreData[]>([]);
  const [employees, setEmployees] = useState<EmployeeData[]>([]);

  // Filter
  const [filterOwnerId, setFilterOwnerId] = useState("");
  const [filterStoreId, setFilterStoreId] = useState("");

  // Forms — create
  const [ownerForm, setOwnerForm] = useState(defaultOwnerForm);
  const [storeForm, setStoreForm] = useState(defaultStoreForm);
  const [empForm, setEmpForm] = useState(defaultEmpForm);

  // Forms — edit
  const [editingOwner, setEditingOwner] = useState<OwnerData | null>(null);
  const [editOwnerForm, setEditOwnerForm] = useState({ name: "", password: "", max_stores: "", max_employees: "", is_active: true });
  const [editingStore, setEditingStore] = useState<StoreData | null>(null);
  const [editStoreForm, setEditStoreForm] = useState({ name: "", lat: "", lng: "", radius_meters: "" });
  const [editingEmp, setEditingEmp] = useState<EmployeeData | null>(null);
  const [editEmpForm, setEditEmpForm] = useState({ name: "", pin: "" });

  // UI state
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const signOut = () => supabase.auth.signOut().then(() => (window.location.href = "/login"));

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadOwners = useCallback(async () => {
    const res = await fetch("/api/admin/owners");
    if (!res.ok) return;
    const data = await res.json();
    setOwners(data.owners ?? []);
  }, []);

  const loadStores = useCallback(async (owner_id?: string) => {
    const url = owner_id ? `/api/admin/stores?owner_id=${owner_id}` : "/api/admin/stores";
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    setStores(data.stores ?? []);
  }, []);

  const loadEmployees = useCallback(async (store_id: string) => {
    if (!store_id) { setEmployees([]); return; }
    const res = await fetch(`/api/admin/employees?store_id=${store_id}`);
    if (!res.ok) return;
    const data = await res.json();
    setEmployees(data.employees ?? []);
  }, []);

  useEffect(() => { loadOwners(); }, [loadOwners]);
  useEffect(() => { if (tab === "stores") loadStores(filterOwnerId || undefined); }, [tab, filterOwnerId, loadStores]);
  useEffect(() => { if (tab === "employees") loadEmployees(filterStoreId); }, [tab, filterStoreId, loadEmployees]);

  const fillCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(8);
        const lng = pos.coords.longitude.toFixed(8);
        if (editingStore) {
          setEditStoreForm((f) => ({ ...f, lat, lng }));
        } else {
          setStoreForm((f) => ({ ...f, lat, lng }));
        }
      },
      () => showToast("ไม่สามารถระบุตำแหน่งได้", false)
    );
  };

  // ── Owner CRUD ────────────────────────────────────────────────────────────────

  const createOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/admin/owners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...ownerForm,
        max_stores: parseInt(ownerForm.max_stores) || 1,
        max_employees: parseInt(ownerForm.max_employees) || 10,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { showToast(data.error ?? "เกิดข้อผิดพลาด", false); return; }
    showToast("สร้างบัญชีเจ้าของร้านสำเร็จ");
    setOwners((prev) => [data.owner, ...prev]);
    setOwnerForm(defaultOwnerForm);
  };

  const updateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOwner) return;
    setLoading(true);
    const payload: Record<string, unknown> = { owner_id: editingOwner.id };
    if (editOwnerForm.name) payload.name = editOwnerForm.name;
    if (editOwnerForm.password) payload.password = editOwnerForm.password;
    if (editOwnerForm.max_stores) payload.max_stores = parseInt(editOwnerForm.max_stores);
    if (editOwnerForm.max_employees) payload.max_employees = parseInt(editOwnerForm.max_employees);
    payload.is_active = editOwnerForm.is_active;

    const res = await fetch("/api/admin/owners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { showToast(data.error ?? "เกิดข้อผิดพลาด", false); return; }
    showToast("อัปเดตข้อมูลสำเร็จ");
    setOwners((prev) => prev.map((o) => o.id === editingOwner.id ? {
      ...o,
      name: editOwnerForm.name || o.name,
      max_stores: editOwnerForm.max_stores ? parseInt(editOwnerForm.max_stores) : o.max_stores,
      max_employees: editOwnerForm.max_employees ? parseInt(editOwnerForm.max_employees) : o.max_employees,
      is_active: editOwnerForm.is_active,
    } : o));
    setEditingOwner(null);
  };

  const deleteOwner = async (owner: OwnerData) => {
    if (!confirm(`ลบบัญชี "${owner.email}" และร้านค้าทั้งหมด?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    const res = await fetch(`/api/admin/owners?owner_id=${owner.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { showToast(data.error ?? "เกิดข้อผิดพลาด", false); return; }
    showToast("ลบบัญชีสำเร็จ");
    setOwners((prev) => prev.filter((o) => o.id !== owner.id));
  };

  // ── Store CRUD ────────────────────────────────────────────────────────────────

  const createStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/admin/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...storeForm,
        lat: parseFloat(storeForm.lat),
        lng: parseFloat(storeForm.lng),
        radius_meters: parseInt(storeForm.radius_meters),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { showToast(data.error ?? "เกิดข้อผิดพลาด", false); return; }
    showToast("สร้างร้านสำเร็จ");
    const owner = owners.find((o) => o.id === storeForm.owner_id);
    setStores((prev) => [{ ...data.store, owner_email: owner?.email ?? "", owner_name: owner?.name ?? "", employee_count: 0 }, ...prev]);
    setOwners((prev) => prev.map((o) => o.id === storeForm.owner_id ? { ...o, store_count: o.store_count + 1 } : o));
    setStoreForm(defaultStoreForm);
  };

  const updateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    setLoading(true);
    const res = await fetch("/api/admin/stores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        store_id: editingStore.id,
        name: editStoreForm.name,
        lat: parseFloat(editStoreForm.lat),
        lng: parseFloat(editStoreForm.lng),
        radius_meters: parseInt(editStoreForm.radius_meters),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { showToast(data.error ?? "เกิดข้อผิดพลาด", false); return; }
    showToast("อัปเดตร้านสำเร็จ");
    setStores((prev) => prev.map((s) => s.id === editingStore.id ? {
      ...s,
      name: editStoreForm.name,
      lat: parseFloat(editStoreForm.lat),
      lng: parseFloat(editStoreForm.lng),
      radius_meters: parseInt(editStoreForm.radius_meters),
    } : s));
    setEditingStore(null);
  };

  const deleteStore = async (store: StoreData) => {
    if (!confirm(`ลบร้าน "${store.name}" และพนักงานทั้งหมด?`)) return;
    const res = await fetch(`/api/admin/stores?store_id=${store.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { showToast(data.error ?? "เกิดข้อผิดพลาด", false); return; }
    showToast("ลบร้านสำเร็จ");
    setStores((prev) => prev.filter((s) => s.id !== store.id));
    setOwners((prev) => prev.map((o) => o.id === store.owner_id ? { ...o, store_count: Math.max(0, o.store_count - 1) } : o));
  };

  // ── Employee CRUD ─────────────────────────────────────────────────────────────

  const createEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const body: Record<string, string> = { store_id: empForm.store_id, name: empForm.name, pin: empForm.pin };
    if (empForm.email) { body.email = empForm.email; body.password = empForm.password; }
    const res = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { showToast(data.error ?? "เกิดข้อผิดพลาด", false); return; }
    showToast("สร้างพนักงานสำเร็จ");
    if (filterStoreId === empForm.store_id) setEmployees((prev) => [data.employee, ...prev]);
    setEmpForm(defaultEmpForm);
  };

  const updateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;
    setLoading(true);
    const res = await fetch("/api/admin/employees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: editingEmp.id, ...editEmpForm }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { showToast(data.error ?? "เกิดข้อผิดพลาด", false); return; }
    showToast("อัปเดตพนักงานสำเร็จ");
    setEmployees((prev) => prev.map((emp) => emp.id === editingEmp.id ? { ...emp, name: editEmpForm.name || emp.name } : emp));
    setEditingEmp(null);
  };

  const toggleEmployeeActive = async (emp: EmployeeData) => {
    const res = await fetch("/api/admin/employees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: emp.id, is_active: !emp.is_active }),
    });
    if (!res.ok) { showToast("เกิดข้อผิดพลาด", false); return; }
    setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, is_active: !e.is_active } : e));
  };

  const deleteEmployee = async (emp: EmployeeData) => {
    if (!confirm(`ลบพนักงาน "${emp.name}"?`)) return;
    const res = await fetch(`/api/admin/employees?employee_id=${emp.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { showToast(data.error ?? "เกิดข้อผิดพลาด", false); return; }
    showToast("ลบพนักงานสำเร็จ");
    setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
  };

  // ── Filtered stores for employee tab ─────────────────────────────────────────
  const storesForFilter = filterOwnerId
    ? stores.filter((s) => s.owner_id === filterOwnerId)
    : stores;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-gradient)" }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-up"
          style={{ background: toast.ok ? "var(--primary-bg)" : "var(--danger-bg)", color: toast.ok ? "var(--primary-dark)" : "var(--danger)", border: `1px solid ${toast.ok ? "var(--primary)" : "var(--danger)"}`, borderRadius: "14px", padding: "12px 18px", fontWeight: 600, fontSize: "0.875rem", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo iconSize={28} textSize={14} />
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: "var(--accent-bg)", color: "var(--accent-dark)" }}>
              Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={signOut} className="btn-ghost text-xs px-3 py-1.5" style={{ color: "var(--danger)" }}>
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl w-fit" style={{ background: "var(--surface)" }}>
          {(["owners", "stores", "employees"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
              style={tab === t
                ? { background: "var(--accent)", color: "#fff", boxShadow: "0 2px 8px rgba(251,146,60,0.4)" }
                : { color: "var(--text-muted)" }}>
              {t === "owners" ? "เจ้าของร้าน" : t === "stores" ? "ร้านค้า" : "พนักงาน"}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB: OWNERS                                                     */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {tab === "owners" && (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

            {/* Create / Edit form */}
            <div className="card-glass p-6 space-y-5">
              <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>
                {editingOwner ? "แก้ไขบัญชีเจ้าของร้าน" : "สร้างบัญชีเจ้าของร้าน"}
              </h2>
              <form onSubmit={editingOwner ? updateOwner : createOwner} className="space-y-3">
                {!editingOwner && (
                  <>
                    <input required placeholder="ชื่อ-นามสกุล" value={ownerForm.name}
                      onChange={(e) => setOwnerForm((f) => ({ ...f, name: e.target.value }))}
                      className="input-base" />
                    <input required type="email" placeholder="อีเมล" value={ownerForm.email}
                      onChange={(e) => setOwnerForm((f) => ({ ...f, email: e.target.value }))}
                      className="input-base" />
                    <input required type="password" placeholder="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)" value={ownerForm.password}
                      onChange={(e) => setOwnerForm((f) => ({ ...f, password: e.target.value }))}
                      className="input-base" />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>จำนวนร้านสูงสุด</label>
                        <input required type="number" min="1" placeholder="1" value={ownerForm.max_stores}
                          onChange={(e) => setOwnerForm((f) => ({ ...f, max_stores: e.target.value }))}
                          className="input-base" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>พนักงานสูงสุด</label>
                        <input required type="number" min="1" placeholder="10" value={ownerForm.max_employees}
                          onChange={(e) => setOwnerForm((f) => ({ ...f, max_employees: e.target.value }))}
                          className="input-base" />
                      </div>
                    </div>
                  </>
                )}
                {editingOwner && (
                  <>
                    <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{editingOwner.email}</p>
                    <input placeholder="ชื่อใหม่ (ถ้าต้องการเปลี่ยน)" value={editOwnerForm.name}
                      onChange={(e) => setEditOwnerForm((f) => ({ ...f, name: e.target.value }))}
                      className="input-base" />
                    <input type="password" placeholder="รหัสผ่านใหม่ (ถ้าต้องการเปลี่ยน)" value={editOwnerForm.password}
                      onChange={(e) => setEditOwnerForm((f) => ({ ...f, password: e.target.value }))}
                      className="input-base" />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>ร้านสูงสุด</label>
                        <input type="number" min="1" placeholder={String(editingOwner.max_stores ?? 1)} value={editOwnerForm.max_stores}
                          onChange={(e) => setEditOwnerForm((f) => ({ ...f, max_stores: e.target.value }))}
                          className="input-base" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>พนักงานสูงสุด</label>
                        <input type="number" min="1" placeholder={String(editingOwner.max_employees ?? 10)} value={editOwnerForm.max_employees}
                          onChange={(e) => setEditOwnerForm((f) => ({ ...f, max_employees: e.target.value }))}
                          className="input-base" />
                      </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={editOwnerForm.is_active}
                          onChange={(e) => setEditOwnerForm((f) => ({ ...f, is_active: e.target.checked }))} />
                        <div className="w-10 h-5 rounded-full transition-colors"
                          style={{ background: editOwnerForm.is_active ? "var(--primary)" : "var(--border-strong)" }} />
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                          style={{ transform: editOwnerForm.is_active ? "translateX(20px)" : "translateX(0)" }} />
                      </div>
                      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                        {editOwnerForm.is_active ? "บัญชีใช้งานได้" : "บัญชีถูกระงับ"}
                      </span>
                    </label>
                  </>
                )}
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="btn-lime flex-1 py-2.5 text-sm">
                    {loading ? "กำลังบันทึก..." : editingOwner ? "บันทึก" : "สร้างบัญชี"}
                  </button>
                  {editingOwner && (
                    <button type="button" onClick={() => setEditingOwner(null)} className="btn-outlined px-4 py-2.5 text-sm">
                      ยกเลิก
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Owners list */}
            <div className="space-y-3">
              {owners.length === 0 && (
                <div className="card-glass p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  ยังไม่มีบัญชีเจ้าของร้าน
                </div>
              )}
              {owners.map((owner) => (
                <div key={owner.id} className="card-glass p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                      style={{ background: "var(--accent-bg)", color: "var(--accent-dark)" }}>
                      {owner.name.charAt(0) || owner.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>{owner.name || "—"}</p>
                        {owner.is_active === false && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-md shrink-0"
                            style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>ระงับ</span>
                        )}
                      </div>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{owner.email}</p>
                    </div>
                    <button onClick={() => {
                      setEditingOwner(owner);
                      setEditOwnerForm({
                        name: owner.name, password: "",
                        max_stores: String(owner.max_stores ?? 1),
                        max_employees: String(owner.max_employees ?? 10),
                        is_active: owner.is_active ?? true,
                      });
                    }} className="btn-ghost p-2 rounded-xl shrink-0" title="แก้ไข">
                      <svg className="w-4 h-4" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => deleteOwner(owner)} className="btn-ghost p-2 rounded-xl shrink-0" title="ลบ">
                      <svg className="w-4 h-4" style={{ color: "var(--danger)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  {/* Profile limits */}
                  {owner.max_stores !== null && (
                    <div className="flex gap-2 pl-[52px]">
                      <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                        style={{ background: "var(--primary-bg)", color: "var(--primary-dark)" }}>
                        ร้าน {owner.store_count}/{owner.max_stores}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                        style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                        พนักงานสูงสุด {owner.max_employees}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB: STORES                                                     */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {tab === "stores" && (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

            {/* Create / Edit form */}
            <div className="card-glass p-6 space-y-5">
              <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>
                {editingStore ? "แก้ไขร้านค้า" : "สร้างร้านค้า"}
              </h2>
              <form onSubmit={editingStore ? updateStore : createStore} className="space-y-3">
                {!editingStore && (
                  <select required value={storeForm.owner_id}
                    onChange={(e) => setStoreForm((f) => ({ ...f, owner_id: e.target.value }))}
                    className="input-base">
                    <option value="">-- เลือกเจ้าของร้าน --</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>{o.name || o.email}</option>
                    ))}
                  </select>
                )}
                <input required placeholder="ชื่อร้าน"
                  value={editingStore ? editStoreForm.name : storeForm.name}
                  onChange={(e) => editingStore
                    ? setEditStoreForm((f) => ({ ...f, name: e.target.value }))
                    : setStoreForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-base" />
                <div className="grid grid-cols-2 gap-2">
                  <input required placeholder="Latitude" type="number" step="any"
                    value={editingStore ? editStoreForm.lat : storeForm.lat}
                    onChange={(e) => editingStore
                      ? setEditStoreForm((f) => ({ ...f, lat: e.target.value }))
                      : setStoreForm((f) => ({ ...f, lat: e.target.value }))}
                    className="input-base" />
                  <input required placeholder="Longitude" type="number" step="any"
                    value={editingStore ? editStoreForm.lng : storeForm.lng}
                    onChange={(e) => editingStore
                      ? setEditStoreForm((f) => ({ ...f, lng: e.target.value }))
                      : setStoreForm((f) => ({ ...f, lng: e.target.value }))}
                    className="input-base" />
                </div>
                <button type="button" onClick={fillCurrentLocation}
                  className="btn-ghost w-full py-2 text-xs flex items-center justify-center gap-2"
                  style={{ color: "var(--primary-dark)" }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  ใช้ตำแหน่งปัจจุบัน
                </button>
                <div className="flex items-center gap-2">
                  <input required placeholder="รัศมี (เมตร)" type="number" min="1"
                    value={editingStore ? editStoreForm.radius_meters : storeForm.radius_meters}
                    onChange={(e) => editingStore
                      ? setEditStoreForm((f) => ({ ...f, radius_meters: e.target.value }))
                      : setStoreForm((f) => ({ ...f, radius_meters: e.target.value }))}
                    className="input-base flex-1" />
                  <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>เมตร</span>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="btn-lime flex-1 py-2.5 text-sm">
                    {loading ? "กำลังบันทึก..." : editingStore ? "บันทึก" : "สร้างร้าน"}
                  </button>
                  {editingStore && (
                    <button type="button" onClick={() => setEditingStore(null)} className="btn-outlined px-4 py-2.5 text-sm">
                      ยกเลิก
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Stores list */}
            <div className="space-y-4">
              {/* Filter */}
              <select value={filterOwnerId} onChange={(e) => setFilterOwnerId(e.target.value)} className="input-base max-w-xs">
                <option value="">ร้านค้าทั้งหมด</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.name || o.email}</option>)}
              </select>

              {stores.length === 0 && (
                <div className="card-glass p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  ยังไม่มีร้านค้า
                </div>
              )}
              {stores.map((store) => (
                <div key={store.id} className="card-glass p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "var(--primary-bg)" }}>
                      <svg className="w-4 h-4" style={{ color: "var(--primary-dark)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{store.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {store.owner_name || store.owner_email}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {store.lat}, {store.lng} · {store.radius_meters}m · {store.employee_count} พนักงาน
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => {
                        setEditingStore(store);
                        setEditStoreForm({ name: store.name, lat: String(store.lat), lng: String(store.lng), radius_meters: String(store.radius_meters) });
                      }} className="btn-ghost p-2 rounded-xl" title="แก้ไข">
                        <svg className="w-4 h-4" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => deleteStore(store)} className="btn-ghost p-2 rounded-xl" title="ลบ">
                        <svg className="w-4 h-4" style={{ color: "var(--danger)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB: EMPLOYEES                                                  */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {tab === "employees" && (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">

            {/* Create / Edit form */}
            <div className="card-glass p-6 space-y-5">
              <h2 className="font-bold text-base" style={{ color: "var(--text)" }}>
                {editingEmp ? "แก้ไขพนักงาน" : "เพิ่มพนักงาน"}
              </h2>
              <form onSubmit={editingEmp ? updateEmployee : createEmployee} className="space-y-3">
                {!editingEmp && (
                  <>
                    <select required value={empForm.store_id}
                      onChange={(e) => setEmpForm((f) => ({ ...f, store_id: e.target.value }))}
                      className="input-base">
                      <option value="">-- เลือกร้านค้า --</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.owner_name || s.owner_email})</option>
                      ))}
                    </select>
                    <input required placeholder="ชื่อพนักงาน" value={empForm.name}
                      onChange={(e) => setEmpForm((f) => ({ ...f, name: e.target.value }))}
                      className="input-base" />
                    <input required placeholder="PIN 4 หลัก" maxLength={4} value={empForm.pin}
                      onChange={(e) => setEmpForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))}
                      className="input-base" />
                    <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>บัญชีสำหรับเข้าสู่ระบบ (ไม่บังคับ)</p>
                    <input type="email" placeholder="อีเมล (ถ้าต้องการ)" value={empForm.email}
                      onChange={(e) => setEmpForm((f) => ({ ...f, email: e.target.value }))}
                      className="input-base" />
                    {empForm.email && (
                      <input type="password" placeholder="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)" value={empForm.password}
                        onChange={(e) => setEmpForm((f) => ({ ...f, password: e.target.value }))}
                        className="input-base" />
                    )}
                  </>
                )}
                {editingEmp && (
                  <>
                    <input placeholder="ชื่อใหม่ (ถ้าต้องการเปลี่ยน)" value={editEmpForm.name}
                      onChange={(e) => setEditEmpForm((f) => ({ ...f, name: e.target.value }))}
                      className="input-base" />
                    <input placeholder="PIN ใหม่ (ถ้าต้องการเปลี่ยน)" maxLength={4} value={editEmpForm.pin}
                      onChange={(e) => setEditEmpForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))}
                      className="input-base" />
                  </>
                )}
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="btn-lime flex-1 py-2.5 text-sm">
                    {loading ? "กำลังบันทึก..." : editingEmp ? "บันทึก" : "เพิ่มพนักงาน"}
                  </button>
                  {editingEmp && (
                    <button type="button" onClick={() => setEditingEmp(null)} className="btn-outlined px-4 py-2.5 text-sm">
                      ยกเลิก
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Employees list */}
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex gap-2 flex-wrap">
                <select value={filterOwnerId}
                  onChange={(e) => { setFilterOwnerId(e.target.value); setFilterStoreId(""); loadStores(e.target.value || undefined); }}
                  className="input-base max-w-[200px]">
                  <option value="">เจ้าของทั้งหมด</option>
                  {owners.map((o) => <option key={o.id} value={o.id}>{o.name || o.email}</option>)}
                </select>
                <select value={filterStoreId} onChange={(e) => setFilterStoreId(e.target.value)}
                  className="input-base max-w-[200px]">
                  <option value="">-- เลือกร้านเพื่อดูพนักงาน --</option>
                  {storesForFilter.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {!filterStoreId && (
                <div className="card-glass p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  เลือกร้านค้าเพื่อดูรายชื่อพนักงาน
                </div>
              )}

              {filterStoreId && employees.length === 0 && (
                <div className="card-glass p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  ยังไม่มีพนักงานในร้านนี้
                </div>
              )}

              {employees.map((emp) => (
                <div key={emp.id} className="card-glass p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                    style={{ background: emp.is_active ? "linear-gradient(135deg,#a3e635,#84cc16)" : "var(--surface-2)", color: emp.is_active ? "#1a2e05" : "var(--text-muted)" }}>
                    {emp.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>{emp.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {emp.user_id ? "มีบัญชี" : "ไม่มีบัญชี"}
                    </p>
                  </div>
                  <span className={emp.is_active ? "badge-lime" : "badge-orange"}>
                    {emp.is_active ? "ใช้งาน" : "ระงับ"}
                  </span>
                  <button onClick={() => toggleEmployeeActive(emp)}
                    className="btn-ghost p-2 rounded-xl shrink-0" title="เปลี่ยนสถานะ">
                    <svg className="w-4 h-4" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                  </button>
                  <button onClick={() => { setEditingEmp(emp); setEditEmpForm({ name: emp.name, pin: "" }); }}
                    className="btn-ghost p-2 rounded-xl shrink-0" title="แก้ไข">
                    <svg className="w-4 h-4" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => deleteEmployee(emp)}
                    className="btn-ghost p-2 rounded-xl shrink-0" title="ลบ">
                    <svg className="w-4 h-4" style={{ color: "var(--danger)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
