"use client";

import { useEffect, useState } from "react";

export default function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    // Capture install prompt (Chrome/Android)
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", () => setShowInstall(false));

    if (!("serviceWorker" in navigator)) {
      return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    }

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.update();

      const checkWaiting = () => {
        if (reg.waiting) setUpdateReady(true);
      };
      checkWaiting();

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateReady(true);
          }
        });
      });
    }).catch(() => {});

    // Reload when new SW takes control
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloading) { reloading = true; window.location.reload(); }
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const handleUpdate = () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
    setUpdateReady(false);
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (installPrompt as any).prompt();
    setShowInstall(false);
    setInstallPrompt(null);
  };

  return (
    <>
      {/* Update banner */}
      {updateReady && (
        <div className="fixed bottom-4 left-1/2 z-50 animate-fade-up"
          style={{ transform: "translateX(-50%)", width: "calc(100% - 2rem)", maxWidth: "400px" }}>
          <div className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <svg className="w-4 h-4 shrink-0" style={{ color: "#f97316" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>มีการอัปเดตใหม่</span>
            </div>
            <button onClick={handleUpdate}
              className="text-xs font-bold px-3 py-1.5 rounded-lg shrink-0"
              style={{ background: "#f97316", color: "#fff" }}>
              อัปเดต
            </button>
          </div>
        </div>
      )}

      {/* Install banner */}
      {showInstall && !updateReady && (
        <div className="fixed bottom-4 left-1/2 z-50 animate-fade-up"
          style={{ transform: "translateX(-50%)", width: "calc(100% - 2rem)", maxWidth: "400px" }}>
          <div className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <img src="/icon.svg" width={28} height={28} alt="" />
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>ติดตั้งแอพบนหน้าจอ</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setShowInstall(false)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ color: "var(--text-muted)" }}>
                ไว้ก่อน
              </button>
              <button onClick={handleInstall}
                className="text-xs font-bold px-3 py-1.5 rounded-lg"
                style={{ background: "#f97316", color: "#fff" }}>
                ติดตั้ง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
