import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export function LoadingState({
  steps,
  progress,
}: {
  steps: string[];
  progress: string[];
}) {
  const latest = progress[progress.length - 1];

  return (
    <div className="space-y-4 rounded-[10px] border border-[#1e1e1e] bg-[#111111] p-5">
      <div className="space-y-2">
        {steps.map((step, index) => {
          const active = index < Math.max(1, progress.length);
          return (
            <div
              key={step}
              className={cn(
                "flex items-center gap-2 rounded-md border border-[#1e1e1e] bg-background/40 px-3 py-2 text-sm transition-opacity duration-200",
                active ? "opacity-100 text-foreground" : "opacity-35 text-muted-foreground"
              )}
            >
              <LoaderCircle className={cn("h-4 w-4 text-cyan-300", active && "animate-spin")} />
              {step}
            </div>
          );
        })}
      </div>

      {latest && (
        <div className="rounded-md border border-[#1e1e1e] bg-background/40 p-3 text-xs text-muted-foreground">
          {latest}
        </div>
      )}

      <div className="space-y-3">
        <div className="skeleton-shimmer h-[160px] rounded-[10px] border border-[#1e1e1e]" />
        <div className="skeleton-shimmer h-[260px] rounded-[10px] border border-[#1e1e1e]" />
        <div className="skeleton-shimmer h-[180px] rounded-[10px] border border-[#1e1e1e]" />
        <div className="skeleton-shimmer h-[220px] rounded-[10px] border border-[#1e1e1e]" />
      </div>
    </div>
  );
}
