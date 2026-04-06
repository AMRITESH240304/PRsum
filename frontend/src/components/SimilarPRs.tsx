import { History, ShieldAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PRSummary } from "@/types";

type SimilarPRItem = {
  id: string;
  repoName: string;
  title: string;
  prNumber: number;
  ageLabel: string;
  riskLevel: "low" | "medium" | "high";
  changeType: string;
};

const MOCK_HISTORY: SimilarPRItem[] = [
  {
    id: "h-823",
    repoName: "pocketpaw/pocketpaw",
    title: "fix(auth): token expiry bypass",
    prNumber: 823,
    ageLabel: "2 weeks ago",
    riskLevel: "high",
    changeType: "fix",
  },
  {
    id: "h-791",
    repoName: "pocketpaw/pocketpaw",
    title: "feat(security): csrf middleware",
    prNumber: 791,
    ageLabel: "1 month ago",
    riskLevel: "medium",
    changeType: "feat",
  },
  {
    id: "h-701",
    repoName: "infra/engine",
    title: "refactor(api): retry headers",
    prNumber: 701,
    ageLabel: "6 weeks ago",
    riskLevel: "medium",
    changeType: "refactor",
  },
  {
    id: "h-633",
    repoName: "pocketpaw/pocketpaw",
    title: "chore(test): auth fuzz tests",
    prNumber: 633,
    ageLabel: "2 months ago",
    riskLevel: "low",
    changeType: "chore",
  },
];

function riskClass(level: SimilarPRItem["riskLevel"]) {
  if (level === "high") {
    return "border-red-500/40 bg-red-500/10 text-red-300";
  }
  if (level === "medium") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  }
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
}

export function SimilarPRs({ summary }: { summary: PRSummary }) {
  const primaryType = summary.changes[0]?.type ?? "feat";

  const matched = MOCK_HISTORY.filter((item) => {
    return item.repoName === summary.repoName || item.changeType === primaryType;
  }).slice(0, 3);

  return (
    <Card className="card-elevated border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <CardTitle className="text-base font-semibold">Similar Past PRs</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {matched.length === 0 ? (
          <p className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            No similar history entries found yet.
          </p>
        ) : (
          matched.map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-background px-3 py-2">
              <p className="text-sm text-foreground">
                {item.title} #{item.prNumber}
              </p>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{item.ageLabel}</span>
                <Badge variant="outline" className={riskClass(item.riskLevel)}>
                  <ShieldAlert className="mr-1 h-3 w-3" /> {item.riskLevel}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
