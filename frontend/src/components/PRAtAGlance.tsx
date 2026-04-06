import { AlertTriangle, FolderOpen, Plus, Minus, Shield } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PRSummary } from "@/types";
import { getOverallReliability, getRisk, isSecurityTitle, normalizeWhatChanged } from "@/lib/summary-utils";

export function PRAtAGlance({ summary }: { summary: PRSummary }) {
  const files = normalizeWhatChanged(summary);
  const totalAdditions = files.reduce((acc, item) => acc + item.additions, 0);
  const totalDeletions = files.reduce((acc, item) => acc + item.deletions, 0);
  const reliability = getOverallReliability(summary);
  const risk = getRisk(summary);

  const breakdown = files.reduce(
    (acc, item) => {
      acc[item.type] += 1;
      return acc;
    },
    { feat: 0, fix: 0, refactor: 0, chore: 0 }
  );

  return (
    <Card className="card-elevated border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">PR at a Glance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-border bg-background px-2 py-2">
            <p className="text-muted-foreground">Files</p>
            <p className="mt-1 flex items-center gap-1 font-mono text-foreground">
              <FolderOpen className="h-3.5 w-3.5 text-primary" /> {files.length}
            </p>
          </div>
          <div className="rounded-md border border-border bg-background px-2 py-2">
            <p className="text-muted-foreground">Additions</p>
            <p className="mt-1 flex items-center gap-1 font-mono text-green-300">
              <Plus className="h-3.5 w-3.5" /> {totalAdditions}
            </p>
          </div>
          <div className="rounded-md border border-border bg-background px-2 py-2">
            <p className="text-muted-foreground">Deletions</p>
            <p className="mt-1 flex items-center gap-1 font-mono text-red-300">
              <Minus className="h-3.5 w-3.5" /> {totalDeletions}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">feat {breakdown.feat}</Badge>
          <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-300">fix {breakdown.fix}</Badge>
          <Badge variant="outline" className="border-blue-500/40 bg-blue-500/10 text-blue-300">refactor {breakdown.refactor}</Badge>
          <Badge variant="outline" className="border-yellow-500/40 bg-yellow-500/10 text-yellow-300">chore {breakdown.chore}</Badge>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge
            variant="outline"
            className={
              risk.level === "high"
                ? "border-red-500/40 bg-red-500/10 text-red-300"
                : risk.level === "medium"
                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            }
          >
            <AlertTriangle className="mr-1 h-3 w-3" /> {risk.level.toUpperCase()} risk
          </Badge>
          {isSecurityTitle(summary.prTitle) && (
            <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-200">
              <Shield className="mr-1 h-3 w-3" /> Security change
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Reliability Score</span>
            <span className="font-mono text-cyan-300">{reliability}% overall</span>
          </div>
          <Progress value={reliability} className="h-2 bg-secondary" />
        </div>
      </CardContent>
    </Card>
  );
}
