"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

const sizeClass: Record<"md" | "lg", string> = {
  md: "max-w-md",
  lg: "max-w-3xl",
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** "lg" dipakai untuk form dua kolom (form + live preview), mis. Bagian 30. */
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 backdrop-blur-sm p-4">
      <div className={`w-full ${sizeClass[size]} max-h-[90vh] overflow-y-auto rounded-xl2 border border-border bg-surface p-6 shadow-float`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-400 hover:bg-surface-muted" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
