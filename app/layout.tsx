import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import CommandPalette from "@/components/layout/CommandPalette";
import { createClient } from "@/lib/supabase/server";
import { getSchoolProfile } from "@/lib/application/schoolProfile.usecases";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "SAKALA V2 Enterprise",
  description: "Platform manajemen jadwal sekolah",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Bagian 76 splash sequence: PROFILE READY → ACADEMIC CONTEXT READY → SHELL READY.
  // Kalau tabel belum ada / query gagal (mis. migration 0002 belum dijalankan),
  // shell tetap render dengan state kosong — bukan error total (Bagian 15.3).
  let schoolProfileNama: string | null = null;
  let activeContextLabel: string | null = null;
  try {
    const supabase = await createClient();
    const [profile, activeContext] = await Promise.all([getSchoolProfile(supabase), getActiveAcademicContext(supabase)]);
    schoolProfileNama = profile?.nama ?? null;
    activeContextLabel = activeContext ? `${activeContext.tahunPelajaran} · ${activeContext.semester === "ganjil" ? "Ganjil" : "Genap"}` : null;
  } catch {
    // biarkan null — Header menampilkan state "Belum diatur"
  }

  return (
    <html lang="id">
      <body className={`${inter.variable} font-sans antialiased text-ink-900`}>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col" style={{ marginLeft: "var(--shell-sidebar-w)" }}>
            <Header schoolProfileNama={schoolProfileNama} activeContextLabel={activeContextLabel} />
            <main className="flex-1 px-8 pb-16 pt-6">{children}</main>
          </div>
        </div>
        <CommandPalette />
      </body>
    </html>
  );
}
