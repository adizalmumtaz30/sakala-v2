"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Bell, ChevronDown, Wifi, WifiOff, GraduationCap, Moon, Sun, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import type { NotificationEntry } from "@/lib/application/notifications.usecases";

function initialsOf(nama: string): string {
  const parts = nama.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

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

// Jam WIB berjalan (real, bukan placeholder) — dipakai baris kedua status
// banner "Online · Sinkron · HH:MM WIB". Update tiap menit, cukup untuk label.
function useClockWIB(): string {
  const [time, setTime] = useState<string>(() => new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date()));
  useEffect(() => {
    const id = setInterval(() => setTime(new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.round(diffMs / 60000));
  if (min < 1) return "Baru saja";
  if (min < 60) return `${min}m lalu`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}j lalu`;
  return `${Math.round(hr / 24)}h lalu`;
}

const TONE_ICON: Record<NotificationEntry["tone"], { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: "bg-brand-50 text-brand-600" },
  success: { icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600" },
  warning: { icon: AlertTriangle, cls: "bg-amber-50 text-amber" },
};

function NotificationBell({ notifications }: { notifications: NotificationEntry[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full p-2 text-ink-500 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : "Notifikasi"}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span aria-hidden="true" className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose px-1 text-[9px] font-bold text-white ring-2 ring-surface">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-[12.5px] font-semibold text-ink-900">Notifikasi Terbaru</p>
            <Link href="/notifikasi" onClick={() => setOpen(false)} className="text-[10.5px] font-semibold text-brand-600 hover:text-brand-700">Lihat semua</Link>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {notifications.length === 0 && <p className="px-4 py-6 text-center text-[11px] text-ink-400">Belum ada aktivitas.</p>}
            {notifications.slice(0, 6).map((n) => {
              const tone = TONE_ICON[n.tone];
              const Icon = tone.icon;
              return (
                <div key={n.id} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-surface-muted">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone.cls}`}><Icon size={12} aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium text-ink-800">{n.title}</span>
                    {n.description && <span className="block truncate text-[10px] text-ink-400">{n.description}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[9px] text-ink-400">
                    {relativeTime(n.createdAt)}
                    {n.unread && <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-label="Belum dibaca" />}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header({
  schoolProfileNama,
  activeContextLabel,
  notifications,
}: {
  schoolProfileNama: string | null;
  activeContextLabel: string | null;
  notifications: NotificationEntry[];
}) {
  const online = useOnlineStatus();
  const clock = useClockWIB();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("sakala-theme", next ? "dark" : "light");
    setDark(next);
  }

  const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-surface/85 px-8 backdrop-blur"
      style={{ height: "var(--shell-topbar-h)" }}
    >
      <button
        type="button"
        className={`flex max-w-md flex-1 items-center gap-2 rounded-xl border border-border bg-surface-muted px-3.5 py-2.5 text-left text-ink-400 transition-all duration-150 hover:border-brand-600/30 hover:shadow-soft ${focusRing}`}
        aria-label="Buka pencarian global"
      >
        <Search size={16} aria-hidden="true" />
        <span className="flex-1 text-[13px]">Cari guru, jadwal, mapel...</span>
        <kbd aria-hidden="true" className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-400">⌘K</kbd>
      </button>

      <Link
        href="/akademik"
        className={`hidden items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors ${focusRing} md:flex ${
          activeContextLabel
            ? "border-border bg-surface text-ink-700 hover:border-brand-600/30"
            : "border-amber/30 bg-amber-50 text-amber hover:border-amber/50"
        }`}
      >
        <GraduationCap size={14} aria-hidden="true" />
        {activeContextLabel ?? "Konteks belum diatur"}
      </Link>

      <div className="ml-auto flex items-center gap-2">
        {/* System Status Banner (golden reference item 10) — dinamis dari status
            koneksi browser + jam WIB berjalan, bukan label statis. */}
        <div
          className={`hidden flex-col items-end px-2 leading-tight md:flex ${online ? "text-emerald" : "text-rose"}`}
          role="status"
          aria-live="polite"
          aria-label={online ? "Semua sistem berjalan normal" : "Koneksi terputus"}
        >
          <span className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-60" />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${online ? "bg-emerald" : "bg-rose"}`} />
            </span>
            {online ? "Semua sistem berjalan normal" : "Koneksi terputus"}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[9.5px] font-medium text-ink-400">
            {online ? <Wifi size={11} aria-hidden="true" /> : <WifiOff size={11} aria-hidden="true" />}
            {online ? "Online" : "Offline"} · {online ? "Sinkron" : "Menunggu koneksi"} · {clock} WIB
          </span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className={`group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-ink-500 shadow-sm transition-all duration-180 hover:border-brand-600/30 hover:bg-surface-muted hover:text-ink-700 ${focusRing}`}
          aria-label={dark ? "Gunakan mode terang" : "Gunakan mode gelap"}
          aria-pressed={dark}
          title={dark ? "Mode terang" : "Mode gelap"}
        >
          {dark ? <Sun size={17} strokeWidth={1.9} aria-hidden="true" /> : <Moon size={17} strokeWidth={1.9} aria-hidden="true" />}
          <span className="pointer-events-none absolute right-0 top-full z-30 mt-2 hidden whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-ink-700 shadow-lg group-hover:block">
            {dark ? "Mode terang" : "Mode gelap"}
          </span>
        </button>

        <NotificationBell notifications={notifications} />

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex min-h-11 items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2 transition-colors hover:bg-surface-muted ${focusRing}`}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-controls="profile-menu"
            aria-label="Buka menu profil"
          >
            <div aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700 ring-2 ring-surface ring-offset-1 ring-offset-brand-100">
              {schoolProfileNama ? initialsOf(schoolProfileNama) : "?"}
            </div>
            <span className="hidden flex-col items-start leading-tight lg:flex">
              <span className="max-w-[140px] truncate text-[12px] font-semibold text-ink-800">{schoolProfileNama ?? "Admin Sekolah"}</span>
              <span className="text-[9.5px] font-medium text-ink-400">Admin Sekolah</span>
            </span>
            <ChevronDown size={15} className="text-ink-400" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div id="profile-menu" role="menu" className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
              <Link role="menuitem" href="/akademik" onClick={() => setMenuOpen(false)} className={`block rounded-lg px-3 py-3 text-[13px] text-ink-700 hover:bg-surface-muted ${focusRing}`}>
                Profil Admin Sekolah
              </Link>
              <div className="my-1 border-t border-border" aria-hidden="true" />
              <button type="button" role="menuitem" onClick={toggleTheme} className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-ink-700 hover:bg-surface-muted ${focusRing}`}>
                {dark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
                <span className="flex-1">Tampilan</span>
                <span className="text-xs text-ink-400">{dark ? "Gelap" : "Terang"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
