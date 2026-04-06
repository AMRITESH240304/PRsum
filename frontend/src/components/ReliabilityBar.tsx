import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

function getReliabilityLabel(score: number) {
  if (score >= 95) {
    return { label: "Looks good", icon: "✅", className: "text-emerald-300" };
  }
  if (score >= 75) {
    return { label: "Review recommended", icon: "⚠", className: "text-yellow-300" };
  }
  if (score >= 50) {
    return { label: "Needs attention", icon: "⚠", className: "text-orange-300" };
  }
  return { label: "Manual review required", icon: "🚨", className: "text-red-300" };
}

export function ReliabilityBar({ reliability }: { reliability: number }) {
  const clamped = Math.max(0, Math.min(100, reliability));
  const reliabilityMeta = getReliabilityLabel(clamped);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono uppercase tracking-wide text-cyan-300">Reliability</span>
        <span className={cn("font-medium", reliabilityMeta.className)}>
          {reliabilityMeta.icon} {reliabilityMeta.label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Progress
          value={clamped}
          className="h-2 bg-secondary"
        />
        <span className="min-w-12 text-right font-mono text-xs text-muted-foreground">{clamped}%</span>
      </div>
    </div>
  );
}
