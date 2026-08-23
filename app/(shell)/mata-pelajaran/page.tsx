import { createClient } from "@/lib/supabase/server";
import { listMataPelajaran } from "@/lib/application/mata-pelajaran.usecases";
import MataPelajaranWorkspace from "./MataPelajaranWorkspace";
import { ErrorState } from "@/components/ui/primitives";

export default async function MataPelajaranPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  try {
    const supabase = await createClient();
    const data = await listMataPelajaran(supabase);
    const { q } = await searchParams;
    return <MataPelajaranWorkspace initialData={data} initialQuery={q ?? ""} />;
  } catch {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat data mata pelajaran dari Supabase." />
      </div>
    );
  }
}
