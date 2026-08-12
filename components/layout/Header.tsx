"use client";

import { Search, Bell, ChevronDown, Wifi } from "lucide-react";

export default function Header() {
  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-surface/85 px-8 backdrop-blur"
      style={{ height: "var(--shell-topbar-h)" }}
    >
      {/* CENTER — Global Search / Command Palette trigger (Bagian 10.2) */}
      <button className="flex max-w-md flex-1 items-center gap-2 rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-left text-ink-400 transition-colors hover:border-brand-600/30">
        <Search size={16} />
        <span className="flex-1 text-[13px]">Cari guru, jadwal, mapel...</span>
        <kbd className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-400">⌘K</kbd>
      </button>

      {/* RIGHT — Connection + notification + profile (Bagian 10.2) */}
      <div className="ml-auto flex items-center gap-5">
        <div className="hidden items-center gap-1.5 text-[12px] font-medium text-emerald md:flex">
          <Wifi size={14} /> Online
        </div>

        <button className="relative rounded-full p-2 text-ink-500 hover:bg-surface-muted" aria-label="Notifikasi">
          <Bell size={18} />
        </button>

        <button className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 hover:bg-surface-muted">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700">
            OP
          </div>
          <ChevronDown size={15} className="text-ink-400" />
        </button>
      </div>
    </header>
  );
}
