import { cn } from "@/lib/cn";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("animate-shimmer rounded-md", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <div className="flex gap-4 py-3 px-6">
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}
