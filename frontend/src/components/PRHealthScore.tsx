import { ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PRSummary } from "@/types";
import { getHealthBreakdown } from "@/lib/summary-utils";

function metricLabel(value: number, max: number, goodThreshold: number, mediumThreshold: number) {
  const ratio = value / Math.max(1, max);
  if (ratio >= goodThreshold) {
    return "Excellent";
  }
  if (ratio >= mediumThreshold) {
    return "Good";
  }
  return "Needs review";
}

export function PRHealthScore({ summary }: { summary: PRSummary }) {
  const breakdown = getHealthBreakdown(summary);

  return (
    <Card className="card-elevated border-border bg-card" id="section-health-score">
      <CardHeader className="items-center pb-2 text-center">
        <div className="flex items-center gap-2 text-cyan-300">
          <ShieldCheck className="h-4 w-4" />
          <CardTitle className="text-base font-semibold">PR Health Score</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5 pt-2">
        <div className="mx-auto flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_28px_rgba(34,211,238,0.25)]">
          <span className="text-3xl font-semibold text-cyan-300">{breakdown.total}</span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span>Test Coverage</span>
              <span>{metricLabel(breakdown.testCoverageScore, 30, 0.75, 0.45)}</span>
            </div>
            <Progress value={(breakdown.testCoverageScore / 30) * 100} className="h-2 bg-secondary" />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span>Risk Level</span>
              <span>{breakdown.risk.level === "high" ? "High Risk" : breakdown.risk.level === "medium" ? "Medium Risk" : "Low Risk"}</span>
            </div>
            <Progress value={(breakdown.riskScore / 30) * 100} className="h-2 bg-secondary" />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span>Change Size</span>
              <span>{metricLabel(breakdown.changeSizeScore, 25, 0.75, 0.45)}</span>
            </div>
            <Progress value={(breakdown.changeSizeScore / 25) * 100} className="h-2 bg-secondary" />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span>Code Quality</span>
              <span>{metricLabel(breakdown.codeQualityScore, 15, 0.75, 0.45)}</span>
            </div>
            <Progress value={(breakdown.codeQualityScore / 15) * 100} className="h-2 bg-secondary" />
          </div>
        </div>

        <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          {breakdown.verdict}
        </p>
      </CardContent>
    </Card>
  );
}
