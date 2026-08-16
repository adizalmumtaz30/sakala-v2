"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Bell, ChevronDown, Wifi, WifiOff, GraduationCap, LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";

function initialsOf(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Bagian 41 online/offline — deteksi asli via navigator.onLine + event
// browser. Connecting/Syncing/Sync Error SENGAJA belum ada: butuh
// infrastruktur offline-queue yang belum dibangun, jadi cuma dua state
// jujur yang bisa diverifikasi (bukan status palsu).
function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}

export default function Header({
  schoolProfileNama,
  activeContextLabel,
  userEmail,
}: {
  schoolProfileNama: string | null;
  activeContextLabel: string | null;
  userEmail: string | null;
}) {
  const online = useOnlineStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

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

      {/* Bagian 8.2 / 77 — Active Academic Context, single source of truth, read-only
          di sini, dikelola penuh (switch/tambah/hapus) di halaman /akademik. */}
      <Link
        href="/akademik"
        className={`hidden items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors md:flex ${
          activeContextLabel
            ? "border-border bg-surface text-ink-700 hover:border-brand-600/30"
            : "border-amber/30 bg-amber-50 text-amber hover:border-amber/50"
        }`}
      >
        <GraduationCap size={14} />
        {activeContextLabel ?? "Konteks belum diatur"}
      </Link>

      {/* RIGHT — Connection + notification + profile (Bagian 10.2) */}
      <div className="ml-auto flex items-center gap-5">
        <div className={`hidden items-center gap-1.5 text-[12px] font-medium md:flex ${online ? "text-emerald" : "text-rose"}`}>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />} {online ? "Online" : "Offline"}
        </div>

        <button className="relative rounded-full p-2 text-ink-500 hover:bg-surface-muted" aria-label="Notifikasi">
          <Bell size={18} />
        </button>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 hover:bg-surface-muted"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700">
              {schoolProfileNama ? initialsOf(schoolProfileNama) : "?"}
            </div>
            <ChevronDown size={15} className="text-ink-400" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-surface py-1.5 shadow-lg">
              {userEmail && (
                <div className="border-b border-border px-3.5 py-2">
                  <p className="truncate text-[12.5px] font-medium text-ink-900">{schoolProfileNama ?? "Admin"}</p>
                  <p className="truncate text-[11.5px] text-ink-400">{userEmail}</p>
                </div>
              )}
              <Link href="/akademik" onClick={() => setMenuOpen(false)} className="block px-3.5 py-2 text-[13px] text-ink-700 hover:bg-surface-muted">
                Profil Admin Sekolah
              </Link>
              <form action={logout}>
                <button type="submit" className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] text-rose hover:bg-rose-50">
                  <LogOut size={14} /> Keluar
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
