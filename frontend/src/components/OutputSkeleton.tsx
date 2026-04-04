export function OutputSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-6">
          <div className="mb-3 h-5 w-1/3 rounded bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-4/5 rounded bg-muted" />
            <div className="h-4 w-2/3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
