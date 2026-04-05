"use client";

export function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[rgba(15,15,26,0.6)] p-6"
        >
          <div className="space-y-3">
            <div className="h-8 w-8 rounded-lg bg-white/[0.05]" />
            <div className="h-8 w-24 rounded-lg bg-white/[0.05]" />
            <div className="h-4 w-16 rounded bg-white/[0.04]" />
          </div>
          {/* Shimmer overlay */}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-shimmer" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[rgba(15,15,26,0.6)] p-6">
      <div className="h-5 w-40 rounded bg-white/[0.05] mb-2" />
      <div className="h-3 w-28 rounded bg-white/[0.04] mb-6" />
      <div className="h-72 rounded-xl bg-white/[0.02]" />
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-shimmer" />
    </div>
  );
}

export function InsightsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[rgba(15,15,26,0.6)] p-5"
        >
          <div className="flex items-start gap-4 pl-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.05]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-16 rounded bg-white/[0.05]" />
              <div className="h-4 w-full rounded bg-white/[0.04]" />
              <div className="h-4 w-3/4 rounded bg-white/[0.03]" />
            </div>
          </div>
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-shimmer" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[rgba(15,15,26,0.6)] p-6">
      <div className="space-y-4">
        <div className="flex gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 w-20 rounded bg-white/[0.05]" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-6">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-5 w-20 rounded bg-white/[0.03]" />
            ))}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-shimmer" />
    </div>
  );
}

export function FullDashboardSkeleton() {
  return (
    <div className="space-y-8">
      <KPISkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <InsightsSkeleton />
      <TableSkeleton />
    </div>
  );
}
