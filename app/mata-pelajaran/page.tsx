import { createClient } from "@/lib/supabase/server";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import MataPelajaranWorkspace from "./MataPelajaranWorkspace";
import { ErrorState } from "@/components/ui/primitives";

export default async function MataPelajaranPage() {
  try {
    const supabase = await createClient();
    const data = await listMataPelajaran(supabase);
    return <MataPelajaranWorkspace initialData={data} />;
  } catch {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat data mata pelajaran dari Supabase." />
      </div>
    );
  }
}
