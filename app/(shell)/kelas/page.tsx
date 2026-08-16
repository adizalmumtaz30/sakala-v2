import { createClient } from "@/lib/supabase/server";
import { listKelas } from "@/lib/application/kelas.usecases";
import KelasWorkspace from "./KelasWorkspace";
import { ErrorState } from "@/components/ui/primitives";

export default async function KelasPage() {
  try {
    const supabase = await createClient();
    const data = await listKelas(supabase);
    return <KelasWorkspace initialData={data} />;
  } catch {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat data kelas dari Supabase." />
      </div>
    );
  }
}
