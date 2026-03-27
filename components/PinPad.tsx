"use client";

import { useState, useRef, useEffect } from "react";

interface PinPadProps {
  onComplete: (pin: string) => void;
  disabled?: boolean;
}

const KEYS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

export default function PinPad({ onComplete, disabled = false }: PinPadProps) {
  const [pin, setPin] = useState("");
  const PIN_LENGTH = 4;
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  const handleKey = (key: string) => {
    if (disabled) return;
    if (key === "⌫") { setPin((p) => p.slice(0, -1)); return; }
    if (key === "") return;
    const next = pin + key;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      onComplete(next);
      resetTimer.current = setTimeout(() => setPin(""), 300);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      {/* Dots */}
      <div className="flex gap-3">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div key={i} className="relative w-3.5 h-3.5">
            <div className={`w-full h-full rounded-full border-2 transition-all duration-200 ${
              i < pin.length
                ? "border-transparent scale-110"
                : "bg-transparent scale-100"
            }`}
              style={i < pin.length
                ? { background: "var(--primary)", borderColor: "var(--primary)" }
                : { borderColor: "var(--border-strong)" }
              }
            />
          </div>
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-2.5">
        {KEYS.map((key, idx) => (
          <button
            key={idx}
            onClick={() => handleKey(key)}
            disabled={disabled || key === ""}
            aria-label={key === "⌫" ? "ลบ" : key === "" ? "" : `กด ${key}`}
            className={`
              w-[70px] h-[58px] rounded-2xl text-xl font-bold
              transition-all duration-100 active:scale-90
              ${key === "" ? "invisible" : ""}
              ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
            `}
            style={key === ""
              ? {}
              : key === "⌫"
              ? {
                  background: "var(--surface-2)",
                  color: "var(--text-muted)",
                  border: "1.5px solid var(--border)",
                }
              : {
                  background: "var(--surface)",
                  color: "var(--text)",
                  border: "1.5px solid var(--border)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }
            }
            onMouseEnter={(e) => {
              if (key !== "" && !disabled) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 0 3px rgba(132,204,22,0.15)";
              }
            }}
            onMouseLeave={(e) => {
              if (key !== "") {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = key !== "⌫" ? "0 2px 8px rgba(0,0,0,0.06)" : "none";
              }
            }}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
