export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-paper-deep" />
          <div className="h-4 w-72 rounded bg-paper-deep/70" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-32 rounded bg-paper-deep" />
          <div className="h-10 w-28 rounded bg-accent/20" />
        </div>
      </div>

      {/* Overview Cards Skeleton */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex h-44 flex-col justify-between rounded-lg border border-border bg-surface p-6">
          <div className="space-y-2">
            <div className="h-5 w-32 rounded bg-paper-deep" />
            <div className="h-3 w-56 rounded bg-paper-deep/70" />
          </div>
          <div className="h-4 w-40 rounded bg-paper-deep/50" />
        </div>
        <div className="flex h-44 flex-col justify-between rounded-lg border border-border bg-surface p-6">
          <div className="space-y-2">
            <div className="h-5 w-32 rounded bg-paper-deep" />
            <div className="h-3 w-48 rounded bg-paper-deep/70" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-8 rounded bg-paper-deep/60" />
            <div className="h-8 rounded bg-paper-deep/60" />
          </div>
        </div>
      </div>

      {/* Content Section Skeleton */}
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="h-6 w-40 rounded bg-paper-deep" />
          <div className="h-3 w-60 rounded bg-paper-deep/70" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex h-48 flex-col justify-between rounded-lg border border-border bg-surface p-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 rounded bg-paper-deep/60" />
                  <div className="h-4 w-12 rounded bg-paper-deep/40" />
                </div>
                <div className="h-5 w-3/4 rounded bg-paper-deep" />
                <div className="h-3 w-1/2 rounded bg-paper-deep/70" />
              </div>
              <div className="flex items-center justify-between border-t border-border/50 pt-3">
                <div className="h-4 w-16 rounded bg-paper-deep/50" />
                <div className="h-4 w-20 rounded bg-paper-deep/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
