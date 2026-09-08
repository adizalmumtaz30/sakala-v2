"use client";

import { useCallback, useState } from "react";
import { AlertTriangle } from "lucide-react";

// Pengganti confirm() browser native — dialog polos bawaan browser
// kontras dengan tampilan premium SAKALA. Dipakai lewat hook supaya tiap
// halaman cukup ganti `if (!confirm(pesan)) return;` jadi
// `if (!(await confirm(pesan))) return;`, tanpa nulis ulang UI dialognya.
export function useConfirm() {
  const [state, setState] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => setState({ message, resolve }));
  }, []);

  function answer(value: boolean) {
    state?.resolve(value);
    setState(null);
  }

  function ConfirmDialog() {
    if (!state) return null;
    return (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/30 p-4 backdrop-blur-sm"
        onClick={() => answer(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm animate-[modalRise_240ms_cubic-bezier(0.16,0.8,0.24,1)] overflow-hidden rounded-xl2 border border-border bg-surface p-5 shadow-float"
        >
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-[2.5px]"
            style={{ background: "linear-gradient(90deg, var(--color-rose) 0%, var(--color-violet) 100%)" }}
          />
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--color-rose) 14%, transparent)", color: "var(--color-rose)" }}
            >
              <AlertTriangle size={18} />
            </span>
            <p className="pt-2 text-[13.5px] leading-relaxed text-ink-800">{state.message}</p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => answer(false)}
              className="rounded-xl border border-border px-3.5 py-2 text-[13px] font-semibold text-ink-700 transition-transform duration-150 active:scale-[0.94]"
            >
              Batal
            </button>
            <button
              onClick={() => answer(true)}
              className="rounded-xl px-3.5 py-2 text-[13px] font-bold text-white transition-[filter,transform] duration-150 hover:brightness-[1.08] active:scale-[0.94] active:brightness-[0.92]"
              style={{ background: "linear-gradient(135deg, var(--color-rose) 0%, color-mix(in srgb, var(--color-rose) 75%, black) 100%)" }}
            >
              Hapus
            </button>
          </div>
        </div>
      </div>
    );
  }

  return { confirm, ConfirmDialog };
}
