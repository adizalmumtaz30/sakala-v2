import { Card } from "@/components/ui/primitives";

function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-[12px] bg-surface-muted ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Memuat Dashboard"
      className="mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-[1480px] flex-col gap-4 px-3 pb-24 pt-4 sm:px-5 lg:gap-5 lg:px-6"
    >
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-2.5 w-32" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <Skeleton className="hidden h-9 w-28 sm:block" />
      </header>

      <section aria-label="Memuat ringkasan utama" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => <Card key={i} className="h-[86px] p-3.5"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 shrink-0 rounded-[13px]" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-2 w-16" /><Skeleton className="h-5 w-12" /><Skeleton className="h-2 w-20" /></div></div></Card>)}
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_315px] xl:gap-5">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,.8fr)]">
          <Card className="h-[275px] p-4"><Skeleton className="h-4 w-32" /><Skeleton className="mt-3 h-2.5 w-52" /><Skeleton className="mt-5 h-[205px] w-full rounded-[16px]" /></Card>
          <Card className="h-[275px] p-4"><Skeleton className="h-4 w-24" /><Skeleton className="mt-3 h-2.5 w-40" /><Skeleton className="mx-auto mt-7 h-[118px] w-[118px] rounded-full" /></Card>
        </div>
        <aside className="space-y-4" aria-label="Memuat informasi pendukung">
          <Card className="h-[250px] p-4"><Skeleton className="h-4 w-24" /><Skeleton className="mt-5 h-[190px] w-full" /></Card>
          <Card className="h-[190px] p-4"><Skeleton className="h-4 w-36" /><div className="mt-5 space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div></Card>
          <Card className="h-[150px] p-4"><Skeleton className="h-4 w-40" /><div className="mt-5 space-y-3"><Skeleton className="h-7 w-full" /><Skeleton className="h-7 w-4/5" /></div></Card>
        </aside>
      </div>
    </main>
  );
}
