"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Database, GraduationCap, Sparkles,
  CalendarClock, BarChart3, History, Bell, Bot, Compass,
} from "lucide-react";

// Bagian 6.1 — Top-level Core (persis, tidak ditambah/dikurangi)
const coreNav = [
  { key: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard },
  { key: "data", label: "Data", href: "/guru", icon: Database },
  { key: "akademik", label: "Akademik", href: "/akademik", icon: GraduationCap },
  { key: "jadwal-cerdas", label: "Jadwal Cerdas", href: "/jadwal-cerdas", icon: Sparkles },
  { key: "jadwal", label: "Jadwal", href: "/jadwal", icon: CalendarClock },
  { key: "analitik", label: "Analitik", href: "/analitik", icon: BarChart3 },
  { key: "riwayat", label: "Riwayat", href: "/riwayat", icon: History },
  { key: "notifikasi", label: "Notifikasi", href: "/notifikasi", icon: Bell },
  { key: "ai", label: "AI", href: "/ai", icon: Bot },
  { key: "navigasi", label: "Navigasi", href: "/navigasi", icon: Compass },
];

// Bagian 6.1 catatan: Data punya sub-entity (Guru/Mapel/Kelas/Ruangan) — Bagian 17 build order
const dataSubnav = [
  { label: "Guru", href: "/guru" },
  { label: "Mata Pelajaran", href: "/mata-pelajaran" },
  { label: "Kelas", href: "/kelas" },
  { label: "Ruangan", href: "/ruangan" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const inDataCore = dataSubnav.some((s) => pathname.startsWith(s.href));

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-surface"
      style={{ width: "var(--shell-sidebar-w)" }}
    >
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <Image src="/logo.png" alt="SAKALA" width={30} height={30} className="shrink-0" />
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-ink-900">SAKALA</p>
          <p className="text-[10px] font-semibold tracking-widest text-ink-400">V2 ENTERPRISE</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="flex flex-col gap-0.5">
          {coreNav.map((item) => {
            const active = item.key === "data" ? inDataCore : pathname === item.href;
            const Icon = item.icon;
            return (
              <div key={item.key}>
                <Link
                  href={item.href}
                  className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                    active ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-surface-muted"
                  }`}
                >
                  <Icon size={17} strokeWidth={2} className={active ? "text-brand-600" : "text-ink-400 group-hover:text-ink-700"} />
                  {item.label}
                </Link>
                {item.key === "data" && inDataCore && (
                  <div className="ml-[26px] mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3">
                    {dataSubnav.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                          pathname.startsWith(sub.href) ? "text-brand-700" : "text-ink-500 hover:text-ink-900"
                        }`}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <p className="px-5 pb-4 text-center text-[10px] text-ink-300">© 2026 SAKALA V2</p>
    </aside>
  );
}
