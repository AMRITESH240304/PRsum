import { Lightbulb, ShieldAlert, TriangleAlert, BadgeCheck } from "lucide-react";

import { SummaryInsight } from "@/types";
import { cn } from "@/lib/utils";

function sanitizeInsightText(text: string) {
  const lowered = text.toLowerCase();
  if (lowered.includes("failed") || lowered.includes("error") || lowered.includes("traceback")) {
    return "Manual review recommended for this PR.";
  }
  return text;
}

export function InsightItem({ insight }: { insight: SummaryInsight }) {
  const normalizedText = sanitizeInsightText(insight.text);

  const styles: Record<SummaryInsight["type"], { className: string; icon: JSX.Element; title: string }> = {
    security: {
      className: "border-red-500/40 bg-red-500/10 text-red-100",
      icon: <ShieldAlert className="mt-0.5 h-4 w-4 text-red-300" />,
      title: "Security Change Detected",
    },
    warning: {
      className: "border-yellow-400/40 bg-yellow-500/10 text-yellow-100",
      icon: <TriangleAlert className="mt-0.5 h-4 w-4 text-yellow-300" />,
      title: "Warning",
    },
    insight: {
      className: "border-cyan-400/40 bg-cyan-500/10 text-cyan-100",
      icon: <Lightbulb className="mt-0.5 h-4 w-4 text-cyan-300" />,
      title: "Insight",
    },
    positive: {
      className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-100",
      icon: <BadgeCheck className="mt-0.5 h-4 w-4 text-emerald-300" />,
      title: "Positive",
    },
  };

  const style = styles[insight.type];

  return (
    <div className={cn("rounded-md border-l-2 px-3 py-2.5 text-sm", style.className)}>
      <div className="flex items-start gap-2">
        {style.icon}
        <div className="space-y-0.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{style.title}</p>
          <p>{normalizedText}</p>
        </div>
      </div>
    </div>
  );
}
