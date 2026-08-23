import { createClient } from "@/lib/supabase/server";
import { listRuangan } from "@/lib/application/ruangan.usecases";
import RuanganWorkspace from "./RuanganWorkspace";
import { ErrorState } from "@/components/ui/primitives";

export default async function RuanganPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  try {
    const supabase = await createClient();
    const data = await listRuangan(supabase);
    const { q } = await searchParams;
    return <RuanganWorkspace initialData={data} initialQuery={q ?? ""} />;
  } catch {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat data ruangan dari Supabase." />
      </div>
    );
  }
}
