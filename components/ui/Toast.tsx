"use client";

import { useCallback, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; tone: ToastTone; text: string };

const TONE_STYLE: Record<ToastTone, { border: string; bg: string; text: string; icon: React.ReactNode }> = {
  success: { border: "border-emerald-200", bg: "bg-emerald-50/95", text: "text-emerald-800", icon: <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> },
  error: { border: "border-rose-200", bg: "bg-rose-50/95", text: "text-rose-800", icon: <AlertTriangle size={16} className="mt-0.5 shrink-0" /> },
  info: { border: "border-brand-600/20", bg: "bg-surface/95", text: "text-ink-700", icon: <Info size={16} className="mt-0.5 shrink-0" /> },
};

// Pengganti window.alert() dan pesan sukses/error berbentuk teks polos —
// mengambang, otomatis hilang, satu bahasa visual dengan Modal/ConfirmDialog
// (rounded-xl2, shadow-float, animasi masuk). Dipakai lewat hook supaya
// halaman cukup panggil toast.success(...)/toast.error(...) tanpa nulis
// ulang UI-nya.
export function useToast() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback((tone: ToastTone, text: string, durationMs = 4000) => {
    const id = ++counter.current;
    setItems((prev) => [...prev, { id, tone, text }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), durationMs);
  }, []);

  const toast = {
    success: (text: string) => push("success", text),
    error: (text: string) => push("error", text),
    info: (text: string) => push("info", text),
  };

  function dismiss(id: number) {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  function ToastHost() {
    if (items.length === 0) return null;
    return (
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((item) => {
          const style = TONE_STYLE[item.tone];
          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex w-full max-w-md animate-[modalRise_220ms_cubic-bezier(0.16,0.8,0.24,1)] items-start gap-2 rounded-2xl border px-4 py-3 text-[12.5px] shadow-float backdrop-blur ${style.border} ${style.bg} ${style.text}`}
            >
              {style.icon}
              <span className="flex-1">{item.text}</span>
              <button onClick={() => dismiss(item.id)} aria-label="Tutup" className="shrink-0 opacity-60 hover:opacity-100">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return { toast, ToastHost };
}
