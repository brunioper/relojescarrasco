import { Skeleton } from "@/components/ui/skeleton";

export default function CatalogueLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 md:pt-14" aria-busy="true">
      <span className="sr-only">Cargando el catálogo…</span>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-4 h-12 w-64" />
      <Skeleton className="mt-10 h-12 w-full" />
      <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-8 md:gap-y-14 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[4/5] w-full rounded-sm" />
            <Skeleton className="mt-4 h-3 w-20" />
            <Skeleton className="mt-2 h-5 w-3/4" />
            <Skeleton className="mt-4 h-5 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
