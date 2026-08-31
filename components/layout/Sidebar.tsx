"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, GraduationCap, BrainCircuit, Target, BookOpen, School2, DoorOpen, Split, CalendarDays, BarChart3, History, Bell, Bot, Compass, ChevronLeft, ChevronRight, LifeBuoy, ArrowUpRight } from "lucide-react";

type NavItem = { label: string; href: string; icon: typeof LayoutDashboard; match?: (path: string) => boolean };
type NavSection = { section: string; items: NavItem[] };

// Urutan & pengelompokan mengikuti alur kerja operator sekolah: siapkan konteks akademik & kurikulum dulu,
// baru isi data master, lalu susun jadwal, lalu pantau lewat analitik. Generate Kurikulum dipromosikan
// jadi item inti (bukan subnav tersembunyi) karena ini fitur utama, bukan pelengkap.
const sections: NavSection[] = [
  {
    section: "Utama",
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard, match: (p) => p === "/" }],
  },
  {
    section: "Akademik",
    items: [
      { label: "Konteks Akademik", href: "/akademik", icon: GraduationCap, match: (p) => p === "/akademik" },
      { label: "Generate Kurikulum", href: "/akademik/generate-kurikulum", icon: BrainCircuit, match: (p) => p.startsWith("/akademik/generate-kurikulum") },
      { label: "Target JP", href: "/pembagian-mengajar/target-jp", icon: Target, match: (p) => p.startsWith("/akademik/target-jp") || p.startsWith("/pembagian-mengajar/target-jp") },
    ],
  },
  {
    section: "Data Master",
    items: [
      { label: "Guru", href: "/guru", icon: Users },
      { label: "Mata Pelajaran", href: "/mata-pelajaran", icon: BookOpen },
      { label: "Kelas", href: "/kelas", icon: School2 },
      { label: "Ruangan", href: "/ruangan", icon: DoorOpen },
      { label: "Pembagian Mengajar", href: "/pembagian-mengajar", icon: Split },
    ],
  },
  {
    section: "Jadwal",
    items: [
      { label: "Jadwal", href: "/jadwal", icon: CalendarDays, match: (p) => p.startsWith("/jadwal") },
    ],
  },
  {
    section: "Analitik",
    items: [{ label: "Analitik", href: "/analitik", icon: BarChart3 }],
  },
  {
    section: "Sistem",
    items: [
      { label: "Riwayat", href: "/riwayat", icon: History },
      { label: "Notifikasi", href: "/notifikasi", icon: Bell },
      { label: "AI", href: "/ai", icon: Bot },
      { label: "Navigasi", href: "/navigasi", icon: Compass },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex flex-col overflow-visible border-r border-border bg-surface transition-[width] duration-200 ease-out" style={{ width: collapsed ? 68 : 240 }}>
      <button type="button" onClick={onToggle} aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"} title={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"} className="absolute -right-3 top-16 z-40 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-ink-500 shadow-sm transition-colors hover:border-brand-600/30 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>
      <div className={`flex items-center gap-3 border-b border-border py-4 ${collapsed ? "justify-center px-2" : "px-5"}`}>
        <Image src="/logo.png" alt="SAKALA" width={30} height={30} className="shrink-0" />
        {!collapsed && <div className="min-w-0 leading-tight"><p className="truncate text-sm font-bold tracking-tight text-ink-900">SAKALA</p><p className="truncate text-[10px] font-semibold tracking-widest text-ink-400">V2 ENTERPRISE</p></div>}
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <div className="flex flex-col gap-4">
          {sections.map((group) => (
            <div key={group.section}>
              {!collapsed && <p className="mb-1.5 px-3 text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-300">{group.section}</p>}
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const active = item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} className={`group relative flex items-center gap-3 rounded-[10px] py-2 text-[13px] font-medium transition-all duration-150 ${collapsed ? "justify-center px-0" : "px-3"} ${active ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-surface-muted"}`}>
                      {active && <span className={`absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-600 ${collapsed ? "left-0.5" : "left-0"}`} />}
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${active ? "bg-brand-100 text-brand-600" : "text-ink-400 group-hover:text-ink-700"}`}>
                        <Icon size={18} strokeWidth={1.8} />
                      </span>
                      {!collapsed && item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
      {!collapsed && (
        <div className="mx-3 mb-3 rounded-2xl border border-border/70 bg-gradient-to-br from-brand-50 to-surface p-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-100 text-brand-600"><LifeBuoy size={16} strokeWidth={1.8} /></span>
          <p className="mt-2.5 text-[11.5px] font-semibold leading-tight text-ink-800">Butuh bantuan?</p>
          <p className="mt-1 text-[9.5px] leading-4 text-ink-400">Panduan &amp; dukungan tim SAKALA siap membantu Anda.</p>
          <Link href="/navigasi" className="mt-2.5 inline-flex items-center gap-1 text-[9.5px] font-semibold text-brand-600 hover:text-brand-700">Pelajari lebih lanjut<ArrowUpRight size={11} /></Link>
        </div>
      )}
      {!collapsed && <p className="px-5 pb-4 text-center text-[10px] text-ink-300">© 2026 SAKALA V2</p>}
    </aside>
  );
}
