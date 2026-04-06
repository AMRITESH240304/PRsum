import { BookOpen, CircleDot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskLevel, StructuredSummary } from "@/types";
import { cn } from "@/lib/utils";

const riskStyle: Record<RiskLevel, string> = {
  low: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.2)]",
  medium: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300 shadow-[0_0_16px_rgba(234,179,8,0.2)]",
  high: "border-red-500/40 bg-red-500/10 text-red-300 shadow-[0_0_16px_rgba(239,68,68,0.2)]",
};

function SummaryRow({ label, content }: { label: string; content: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-20 pt-0.5 text-right font-mono text-xs uppercase tracking-[0.18em] text-cyan-300">
        {label}
      </div>
      <p className="flex-1 text-[15px] leading-[1.6] text-foreground">{content}</p>
    </div>
  );
}

export function StructuredSummaryCard({
  summary,
  riskLevel,
  riskReason,
  animationDelay,
}: {
  summary: StructuredSummary;
  riskLevel: RiskLevel;
  riskReason: string;
  animationDelay?: number;
}) {
  return (
    <Card
      className={cn(
        "card-elevated card-enter border-border",
        riskLevel === "high" ? "bg-[#1a0000]/40" : "bg-card"
      )}
      style={{ animationDelay: `${animationDelay ?? 0}ms` }}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <CardTitle className="text-base tracking-wide">Summary</CardTitle>
        </div>
        <Badge variant="outline" className={riskStyle[riskLevel]}>
          <CircleDot className="mr-1 h-3 w-3" />
          {riskLevel[0].toUpperCase() + riskLevel.slice(1)} Risk
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <SummaryRow label="WHAT" content={summary.what} />
        <SummaryRow label="HOW" content={summary.how} />
        <SummaryRow label="IMPACT" content={summary.impact} />
        <div className="border-t border-border pt-3 text-xs text-muted-foreground">
          Reason: {riskReason}
        </div>
      </CardContent>
    </Card>
  );
}
