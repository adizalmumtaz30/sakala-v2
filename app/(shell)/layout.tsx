import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import CommandPalette from "@/components/layout/CommandPalette";
import { createClient } from "@/lib/supabase/server";
import { getSchoolProfile } from "@/lib/application/schoolProfile.usecases";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";

// Shell untuk semua halaman (Bagian 5 Application Shell). Auth (Bagian 40)
// sudah dihapus total atas permintaan user — tidak ada gate login lagi,
// layout ini murni presentational.
export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  // Bagian 76 splash sequence: PROFILE READY → ACADEMIC CONTEXT READY → SHELL READY.
  // Kalau tabel belum ada / query gagal (mis. migration belum dijalankan),
  // shell tetap render dengan state kosong — bukan error total (Bagian 15.3).
  let schoolProfileNama: string | null = null;
  let activeContextLabel: string | null = null;
  try {
    const supabase = await createClient();
    const [profile, activeContext] = await Promise.all([
      getSchoolProfile(supabase),
      getActiveAcademicContext(supabase),
    ]);
    schoolProfileNama = profile?.nama ?? null;
    activeContextLabel = activeContext ? `${activeContext.tahunPelajaran} · ${activeContext.semester === "ganjil" ? "Ganjil" : "Genap"}` : null;
  } catch {
    // biarkan null — Header menampilkan state "Belum diatur"
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col" style={{ marginLeft: "var(--shell-sidebar-w)" }}>
        <Header schoolProfileNama={schoolProfileNama} activeContextLabel={activeContextLabel} />
        <main className="flex-1 px-8 pb-16 pt-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
