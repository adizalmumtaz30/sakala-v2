import { createClient } from "@/lib/supabase/server";
import { listAcademicContexts } from "@/lib/application/academicContext.usecases";
import { listAuditLog } from "@/lib/application/auditLog.usecases";
import RiwayatWorkspace from "./RiwayatWorkspace";
import { ErrorState } from "@/components/ui/primitives";

const PAGE_SIZE = 50;

export default async function RiwayatPage() {
  try {
    const supabase = await createClient();
    const contexts = await listAcademicContexts(supabase);
    const activeContext = contexts.find((c) => c.isActive) ?? null;

    const { items, total } = await listAuditLog(supabase, {
      academicContextId: activeContext?.id,
      limit: PAGE_SIZE,
      offset: 0,
    });

    return (
      <RiwayatWorkspace
        activeContext={activeContext}
        initialItems={items}
        total={total}
        pageSize={PAGE_SIZE}
      />
    );
  } catch {
    // Bagian 15.3 — server-side fetch gagal, tetap render UI dengan error state.
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ErrorState message="Gagal memuat data Riwayat dari Supabase. Cek koneksi dan environment variable kamu." />
      </div>
    );
  }
}
