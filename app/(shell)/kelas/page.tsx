import { createClient } from "@/lib/supabase/server";
import { listKelas } from "@/lib/application/kelas.usecases";
import KelasWorkspace from "./KelasWorkspace";
import { ErrorState } from "@/components/ui/primitives";

export default async function KelasPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  try {
    const supabase = await createClient();
    const data = await listKelas(supabase);
    const { q } = await searchParams;
    return <KelasWorkspace initialData={data} initialQuery={q ?? ""} />;
  } catch {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat data kelas dari Supabase." />
      </div>
    );
  }
}
