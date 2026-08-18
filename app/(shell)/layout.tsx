import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import CommandPalette from "@/components/layout/CommandPalette";
import SplashScreen from "@/components/splash/SplashScreen";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { createClient } from "@/lib/supabase/server";
import { getSchoolProfile } from "@/lib/application/schoolProfile.usecases";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
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
    // shell tetap render dengan state kosong jika data belum tersedia.
  }

  return (
    <div className="flex min-h-screen">
      <SplashScreen schoolProfileNama={schoolProfileNama} activeContextLabel={activeContextLabel} />
      <Sidebar />
      <div className="flex flex-1 flex-col" style={{ marginLeft: "var(--shell-sidebar-w)" }}>
        <Header schoolProfileNama={schoolProfileNama} activeContextLabel={activeContextLabel} />
        <main className="flex-1 px-8 pb-16 pt-6">{children}</main>
      </div>
      <CommandPalette />
      <ThemeToggle />
    </div>
  );
}
