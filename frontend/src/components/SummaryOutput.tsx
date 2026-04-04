import { PRSummary, RiskLevel } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangeTypeBadge } from "@/components/ChangeTypeBadge";
import { CopyButton } from "@/components/CopyButton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  FileCode,
  ListChecks,
  FileText,
  GitCommit,
  BookOpen,
  GitBranch,
  ArrowRight,
  TriangleAlert,
  Lightbulb,
  CircleDot,
  Clipboard,
  FileDown,
  Save,
  RefreshCcw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const riskStyle: Record<RiskLevel, string> = {
  low: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.25)]",
  medium: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300 shadow-[0_0_16px_rgba(234,179,8,0.25)]",
  high: "border-red-500/40 bg-red-500/10 text-red-300 shadow-[0_0_16px_rgba(239,68,68,0.25)]",
};

function buildMarkdown(summary: PRSummary) {
  const lines = [
    `# ${summary.prTitle}`,
    "",
    `- Repository: ${summary.repoName}`,
    `- PR: #${summary.prNumber}`,
    `- Author: ${summary.author ?? "unknown"}`,
    "",
    "## Summary",
    summary.summary,
    "",
    "## What Changed",
    ...summary.changes.map((change) => `- [${change.type}] ${change.description}`),
    "",
    "## Files Affected",
    ...summary.filesAffected.map((file) => `- ${file.filename} (+${file.additions} / -${file.deletions})`),
    "",
    "## Changelog",
    summary.changelog,
    "",
    "## Diff",
    "```diff",
    summary.rawDiff ?? "",
    "```",
  ];
  return lines.join("\n");
}

export function SummaryOutput({
  summary,
  onResummarize,
  onSaveToHistory,
}: {
  summary: PRSummary;
  onResummarize?: () => void;
  onSaveToHistory?: () => void;
}) {
  const [checklist, setChecklist] = useState(summary.checklist);

  const risk =
    summary.risk ??
    (() => {
      const changed = summary.filesAffected.map((f) => f.filename.toLowerCase());
      if (changed.some((name) => name.includes("config") || name.includes("env"))) {
        return { level: "medium" as const, reason: "core config files modified" };
      }
      if (changed.every((name) => name.includes("readme") || name.includes("docs"))) {
        return { level: "low" as const, reason: "only docs were updated" };
      }
      return { level: "low" as const, reason: "changes are localized and low blast-radius" };
    })();

  const totalFiles = summary.filesAffected.length;
  const totalAdditions = summary.filesAffected.reduce((acc, file) => acc + file.additions, 0);
  const totalDeletions = summary.filesAffected.reduce((acc, file) => acc + file.deletions, 0);
  const prMeta = summary.pr ?? {
    title: summary.prTitle,
    author: summary.author ?? "unknown",
    number: summary.prNumber,
    repo: summary.repoName,
    branch_from: "feature/unknown",
    branch_to: "main",
    status: "open" as const,
    opened: "recently",
    files_changed: totalFiles,
    additions: totalAdditions,
    deletions: totalDeletions,
  };

  const insights =
    summary.insights ??
    [
      {
        type: "insight" as const,
        text: `${totalFiles} files were analyzed and classified into change types`,
      },
      {
        type: "warning" as const,
        text: "No explicit test impact data was found; review test coverage manually",
      },
    ];

  const changeTotals = summary.filesAffected.reduce(
    (acc, file) => {
      acc[file.changeType] += 1;
      return acc;
    },
    { feat: 0, fix: 0, refactor: 0, chore: 0 }
  );

  const totalChanges = Math.max(1, summary.filesAffected.length);
  const checklistDone = checklist.filter((item) => item.checked).length;
  const checklistPercent = Math.round((checklistDone / Math.max(1, checklist.length)) * 100);

  const toggleCheck = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const copyFullSummary = async () => {
    await navigator.clipboard.writeText(buildMarkdown(summary));
    toast.success("Full summary copied");
  };

  const exportMarkdown = () => {
    const markdown = buildMarkdown(summary);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${summary.repoName.replace("/", "-")}-pr-${summary.prNumber}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success("Markdown exported");
  };

  return (
    <div className="space-y-4 pb-24">
      <Card className="animate-fade-in border-border bg-card">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{prMeta.title}</h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Avatar className="h-4 w-4 border border-border">
                  <AvatarFallback className="bg-background text-[9px] text-muted-foreground">
                    {(prMeta.author[0] || "U").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>@{prMeta.author}</span>
              </div>
            </div>
            <Badge
              variant="outline"
              className={
                prMeta.status === "open"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : prMeta.status === "merged"
                    ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
                    : "border-red-500/40 bg-red-500/10 text-red-300"
              }
            >
              <CircleDot className="mr-1 h-3 w-3" />
              {prMeta.status[0].toUpperCase() + prMeta.status.slice(1)}
            </Badge>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
            <span>{prMeta.branch_from}</span>
            <ArrowRight className="h-3.5 w-3.5 text-primary" />
            <span>{prMeta.branch_to}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>#{prMeta.number}</span>
            <span>{prMeta.files_changed} files changed</span>
            <span className="font-mono text-feat">+{prMeta.additions}</span>
            <span className="font-mono text-fix">-{prMeta.deletions}</span>
            <span>opened {prMeta.opened}</span>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="animate-fade-in border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Summary</CardTitle>
          </div>
          <Badge variant="outline" className={riskStyle[risk.level]}>
            <CircleDot className="mr-1 h-3 w-3" />
            {risk.level[0].toUpperCase() + risk.level.slice(1)} Risk
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground">{summary.summary}</p>
          <p className="mt-3 text-xs text-muted-foreground">Reason: {risk.reason}</p>
        </CardContent>
      </Card>

      {/* What Changed */}
      <Card className="animate-fade-in border-border bg-card" style={{ animationDelay: "0.1s" }}>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <GitCommit className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">What Changed</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {summary.changes.map((change, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ChangeTypeBadge type={change.type} />
                <span className="text-foreground">{change.description}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="animate-fade-in border-border bg-card" style={{ animationDelay: "0.15s" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Change Type Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-3 overflow-hidden rounded-full border border-border bg-background">
            <div className="flex h-full w-full">
              <div className="bg-feat" style={{ width: `${(changeTotals.feat / totalChanges) * 100}%` }} />
              <div className="bg-fix" style={{ width: `${(changeTotals.fix / totalChanges) * 100}%` }} />
              <div className="bg-refactor" style={{ width: `${(changeTotals.refactor / totalChanges) * 100}%` }} />
              <div className="bg-chore" style={{ width: `${(changeTotals.chore / totalChanges) * 100}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>feat {changeTotals.feat} ({Math.round((changeTotals.feat / totalChanges) * 100)}%)</span>
            <span>fix {changeTotals.fix} ({Math.round((changeTotals.fix / totalChanges) * 100)}%)</span>
            <span>refactor {changeTotals.refactor} ({Math.round((changeTotals.refactor / totalChanges) * 100)}%)</span>
            <span>chore {changeTotals.chore} ({Math.round((changeTotals.chore / totalChanges) * 100)}%)</span>
          </div>
        </CardContent>
      </Card>

      {/* Files Affected */}
      <Card className="animate-fade-in border-border bg-card" style={{ animationDelay: "0.2s" }}>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <FileCode className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Files Affected</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5">
            {summary.filesAffected.map((file, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <ChangeTypeBadge type={file.changeType} />
                <code className="font-mono text-xs text-foreground">{file.filename}</code>
                <span className="ml-auto font-mono text-xs text-feat">+{file.additions}</span>
                <span className="font-mono text-xs text-fix">-{file.deletions}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="animate-fade-in border-border bg-card" style={{ animationDelay: "0.24s" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AI Insights & Warnings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {insights.map((item, index) => (
            <div
              key={`${item.type}-${index}`}
              className={`rounded-md border-l-2 px-3 py-2 text-sm ${
                item.type === "warning"
                  ? "border-yellow-400 bg-yellow-500/10 text-yellow-200"
                  : "border-cyan-400 bg-cyan-500/10 text-cyan-100"
              }`}
            >
              <div className="flex items-start gap-2">
                {item.type === "warning" ? (
                  <TriangleAlert className="mt-0.5 h-4 w-4" />
                ) : (
                  <Lightbulb className="mt-0.5 h-4 w-4" />
                )}
                <span>{item.text}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="animate-fade-in border-border bg-card" style={{ animationDelay: "0.27s" }}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Review Checklist</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            {checklistDone}/{checklist.length} completed
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={checklistPercent} className="h-2 bg-secondary" />
          <ul className="space-y-2.5">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <Checkbox
                  checked={item.checked}
                  onCheckedChange={() => toggleCheck(item.id)}
                  id={item.id}
                  className="data-[state=checked]:border-green-500 data-[state=checked]:bg-green-500"
                />
                <label
                  htmlFor={item.id}
                  className={`cursor-pointer text-sm ${item.checked ? "text-muted-foreground line-through" : "text-foreground"}`}
                >
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Changelog */}
      <Card className="animate-fade-in border-border bg-card" style={{ animationDelay: "0.3s" }}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Changelog Entry</CardTitle>
          </div>
          <CopyButton text={summary.changelog} label="Copy" />
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-surface p-4 font-mono text-xs leading-relaxed text-foreground">
            {summary.changelog}
          </pre>
        </CardContent>
      </Card>

      {/* Raw Diff */}
      <Card className="animate-fade-in border-border bg-card" style={{ animationDelay: "0.35s" }}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Git Diff</CardTitle>
          </div>
          <CopyButton text={summary.rawDiff ?? ""} label="Copy Diff" />
        </CardHeader>
        <CardContent>
          <pre className="max-h-[420px] overflow-auto rounded-md bg-surface p-4 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
            {summary.rawDiff || "No diff payload was returned for this summary."}
          </pre>
        </CardContent>
      </Card>

      {/* Review Checklist */}
      <div className="sticky bottom-0 z-20 animate-fade-in rounded-md border border-border bg-card/95 p-3 backdrop-blur" style={{ animationDelay: "0.5s" }}>
        <Separator className="mb-3 bg-border" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Button variant="outline" size="sm" className="gap-2" onClick={copyFullSummary}>
            <Clipboard className="h-3.5 w-3.5" /> Copy Full Summary
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportMarkdown}>
            <FileDown className="h-3.5 w-3.5" /> Export as Markdown
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              if (onSaveToHistory) {
                onSaveToHistory();
              } else {
                toast.success("Summary already persisted in history");
              }
            }}
          >
            <Save className="h-3.5 w-3.5" /> Save to History
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={onResummarize}>
            <RefreshCcw className="h-3.5 w-3.5" /> Re-summarize
          </Button>
        </div>
      </div>
    </div>
  );
}
