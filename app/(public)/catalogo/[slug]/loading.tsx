import { Skeleton } from "@/components/ui/skeleton";

export default function ProductLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6" aria-busy="true">
      <span className="sr-only">Cargando el producto…</span>
      <Skeleton className="h-4 w-56" />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1.45fr_1fr] lg:gap-14">
        <Skeleton className="aspect-[4/5] w-full rounded-sm sm:aspect-square" />
        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-10 w-3/4" />
          <Skeleton className="mt-6 h-8 w-48" />
          <Skeleton className="mt-8 h-13 w-full" />
          <Skeleton className="mt-3 h-13 w-full" />
          <Skeleton className="mt-10 h-32 w-full" />
        </div>
      </div>
    </div>
  );
}
