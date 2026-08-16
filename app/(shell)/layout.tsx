import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import CommandPalette from "@/components/layout/CommandPalette";
import { createClient } from "@/lib/supabase/server";
import { getSchoolProfile } from "@/lib/application/schoolProfile.usecases";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";

// Shell untuk semua halaman ber-auth (Bagian 5 Application Shell). Halaman
// /login SENGAJA di luar route group ini — tidak pakai Sidebar/Header.
// Gate akses sesungguhnya ada di middleware.ts (redirect ke /login kalau
// belum ada sesi); layout ini murni presentational.
export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  // Bagian 76 splash sequence: PROFILE READY → ACADEMIC CONTEXT READY → SHELL READY.
  // Kalau tabel belum ada / query gagal (mis. migration belum dijalankan),
  // shell tetap render dengan state kosong — bukan error total (Bagian 15.3).
  let schoolProfileNama: string | null = null;
  let activeContextLabel: string | null = null;
  let userEmail: string | null = null;
  try {
    const supabase = await createClient();
    const [profile, activeContext, userResult] = await Promise.all([
      getSchoolProfile(supabase),
      getActiveAcademicContext(supabase),
      supabase.auth.getUser(),
    ]);
    schoolProfileNama = profile?.nama ?? null;
    activeContextLabel = activeContext ? `${activeContext.tahunPelajaran} · ${activeContext.semester === "ganjil" ? "Ganjil" : "Genap"}` : null;
    userEmail = userResult.data.user?.email ?? null;
  } catch {
    // biarkan null — Header menampilkan state "Belum diatur"
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col" style={{ marginLeft: "var(--shell-sidebar-w)" }}>
        <Header schoolProfileNama={schoolProfileNama} activeContextLabel={activeContextLabel} userEmail={userEmail} />
        <main className="flex-1 px-8 pb-16 pt-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
