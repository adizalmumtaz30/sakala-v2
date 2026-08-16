import { createClient } from "@/lib/supabase/server";
import { listGuru } from "@/lib/application/guru.usecases";
import GuruWorkspace from "./GuruWorkspace";
import { ErrorState } from "@/components/ui/primitives";

export default async function GuruPage() {
  try {
    const supabase = await createClient();
    const guruList = await listGuru(supabase);
    return <GuruWorkspace initialData={guruList} />;
  } catch {
    // Bagian 15.3 — server-side fetch gagal, tetap render UI dengan error state
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat data guru dari Supabase. Cek koneksi dan environment variable kamu." />
      </div>
    );
  }
}
