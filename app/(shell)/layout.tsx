import ShellFrame from "@/components/layout/ShellFrame";
import Header from "@/components/layout/Header";
import CommandPalette from "@/components/layout/CommandPalette";
import SplashScreen from "@/components/splash/SplashScreen";
import { createClient } from "@/lib/supabase/server";
import { getSchoolProfile } from "@/lib/application/schoolProfile.usecases";
import { getActiveAcademicContext } from "@/lib/application/academicContext.usecases";
import { getRecentNotifications, type NotificationEntry } from "@/lib/application/notifications.usecases";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  let schoolProfileNama: string | null = null;
  let activeContextLabel: string | null = null;
  let notifications: NotificationEntry[] = [];
  try {
    const supabase = await createClient();
    const [profile, activeContext] = await Promise.all([
      getSchoolProfile(supabase),
      getActiveAcademicContext(supabase),
    ]);
    schoolProfileNama = profile?.nama ?? null;
    activeContextLabel = activeContext ? `${activeContext.tahunPelajaran} · ${activeContext.semester === "ganjil" ? "Ganjil" : "Genap"}` : null;
    notifications = await getRecentNotifications(supabase, activeContext?.id ?? null).catch(() => []);
  } catch {
    // shell tetap render dengan state kosong jika data belum tersedia.
  }

  return (
    <div className="flex min-h-screen">
      <SplashScreen schoolProfileNama={schoolProfileNama} activeContextLabel={activeContextLabel} />
      <ShellFrame>
        <Header schoolProfileNama={schoolProfileNama} activeContextLabel={activeContextLabel} notifications={notifications} />
        <main className="flex-1 px-5 pb-16 pt-6 lg:px-6">{children}</main>
      </ShellFrame>
      <CommandPalette />
    </div>
  );
}
