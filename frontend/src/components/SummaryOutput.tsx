import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Clipboard,
  FileCode,
  FileDown,
  FileText,
  GitCommit,
  Save,
  RefreshCcw,
  CircleDot,
} from "lucide-react";

import { PRSummary, WhatChangedItem, ChecklistItem as ChecklistItemType, StructuredSummary } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChangeTypeBadge } from "@/components/ChangeTypeBadge";
import { CopyButton } from "@/components/CopyButton";
import { StructuredSummaryCard } from "@/components/StructuredSummary";
import { FileSummaryCard } from "@/components/FileSummaryCard";
import { InsightItem } from "@/components/InsightItem";
import { ChecklistItem } from "@/components/ChecklistItem";
import { DiffViewer } from "@/components/DiffViewer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function isSecurityTitle(title: string) {
  return /(owasp|cve|security|auth|vulnerability|bypass)/i.test(title);
}

function normalizeSummaryText(summary: PRSummary) {
  const generic = /this pr updates|targeted improvements|changing\s+\d+\s+files/i.test(summary.summary);
  if (!generic) {
    return summary.summary;
  }

  const fromFiles = (summary.whatChanged ?? [])
    .slice(0, 2)
    .map((item) => item.what)
    .join(" ");

  if (fromFiles) {
    return fromFiles;
  }

  const firstChange = summary.changes[0]?.description ?? "introduces targeted improvements";
  return `This change set ${firstChange.toLowerCase()} with focused updates across critical paths and supporting tests.`;
}

function buildStructuredSummary(summary: PRSummary): StructuredSummary {
  if (summary.structuredSummary) {
    return summary.structuredSummary;
  }

  const normalized = normalizeSummaryText(summary);
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const what = sentences[0] ?? "Introduces focused changes to improve behavior in key runtime paths.";
  const how =
    sentences[1] ??
    (sentences.slice(1, 3).join(" ") ||
      "Implements the fix through targeted updates in core files and supporting tests.");
  const impact =
    sentences.slice(2).join(" ") ||
    "Reduces operational risk while preserving compatibility for existing integrations and workflows.";

  return { what, how, impact };
}

function inferChecklistPriority(label: string): "critical" | "high" | "medium" {
  const lowered = label.toLowerCase();
  if (/(auth|security|owasp|cve|critical|rate-limit|middleware)/.test(lowered)) {
    return "critical";
  }
  if (/(test|verify|retry|header|endpoint|load)/.test(lowered)) {
    return "high";
  }
  return "medium";
}

function computeReliability(item: WhatChangedItem, allItems: WhatChangedItem[], prTitle: string) {
  if (typeof item.reliability === "number") {
    return Math.max(0, Math.min(100, item.reliability));
  }

  let score = 0;
  const totalLines = item.additions + item.deletions;
  const deletionRatio = item.deletions / Math.max(1, totalLines);
  const itemName = item.filename.toLowerCase();
  const baseName = itemName.split("/").pop()?.replace(/\.[a-z0-9]+$/, "") ?? itemName;
  const hasTestFile = allItems.some((entry) => {
    const name = entry.filename.toLowerCase();
    return (
      name.includes("test") &&
      (name.includes(baseName) || !itemName.includes("test"))
    );
  });
  const isCriticalFile = /(auth|security|config|infra|migration|cve|owasp)/i.test(item.filename);
  const clearCommitMessage = prTitle.trim().length > 16;

  if (hasTestFile) {
    score += 30;
  }
  if (totalLines < 50) {
    score += 20;
  }
  if (!isCriticalFile) {
    score += 20;
  }
  if (clearCommitMessage) {
    score += 15;
  }
  if (deletionRatio <= 0.8) {
    score += 15;
  }

  return Math.max(0, Math.min(100, score));
}

function normalizeWhatChanged(summary: PRSummary): WhatChangedItem[] {
  if (summary.whatChanged && summary.whatChanged.length > 0) {
    return summary.whatChanged.map((item) => ({
      ...item,
      reliability: computeReliability(item, summary.whatChanged ?? [], summary.prTitle),
    }));
  }

  return summary.filesAffected.map((file, index) => {
    const matchingChange = summary.changes[index]?.description ?? `Updated ${file.filename} to support the PR objective.`;
    const item: WhatChangedItem = {
      filename: file.filename,
      type: file.changeType,
      additions: file.additions,
      deletions: file.deletions,
      reliability: 0,
      what: file.summary || matchingChange,
      keyChanges: [
        `Updated ${file.filename.split("/").pop()} implementation flow`,
        `Net code delta: +${file.additions} / -${file.deletions}`,
      ],
      diff: file.patch || "",
    };
    item.reliability = computeReliability(item, [item], summary.prTitle);
    return item;
  });
}

function normalizeInsights(summary: PRSummary) {
  const raw = summary.insights ?? [];
  const sanitized = raw
    .map((item) => {
      const text = item.text;
      if (/failed|error|traceback|exception/i.test(text)) {
        return {
          type: "warning" as const,
          text: "Manual review recommended for this PR.",
        };
      }
      return item;
    })
    .filter((item, index, all) => all.findIndex((entry) => entry.text === item.text && entry.type === item.type) === index);

  if (sanitized.length === 0) {
    return [{ type: "warning" as const, text: "Manual review recommended for this PR." }];
  }

  if (isSecurityTitle(summary.prTitle) && !sanitized.some((item) => item.type === "security")) {
    sanitized.unshift({
      type: "security",
      text: "Auth or security-sensitive logic changed. Security team review is recommended before merge.",
    });
  }

  return sanitized;
}

function normalizeChecklist(summary: PRSummary): ChecklistItemType[] {
  const fromSummary = summary.checklist.length > 0 ? summary.checklist : [
    { id: "1", label: "Review changed file behavior against expected runtime flow", checked: false },
    { id: "2", label: "Run targeted tests for impacted modules and endpoints", checked: false },
    { id: "3", label: "Validate no breaking API contract changes were introduced", checked: false },
  ];

  return fromSummary.map((item) => ({
    ...item,
    priority: item.priority ?? inferChecklistPriority(item.label),
  }));
}

function buildMarkdown(summary: PRSummary, structured: StructuredSummary, whatChanged: WhatChangedItem[]) {
  const lines = [
    `# ${summary.prTitle}`,
    "",
    `- Repository: ${summary.repoName}`,
    `- PR: #${summary.prNumber}`,
    `- Author: ${summary.author ?? "unknown"}`,
    "",
    "## Summary",
    `- WHAT: ${structured.what}`,
    `- HOW: ${structured.how}`,
    `- IMPACT: ${structured.impact}`,
    "",
    "## What Changed",
    ...whatChanged.map((item) => `- [${item.type}] ${item.filename}: ${item.what}`),
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

function renderOpenedTime(summary: PRSummary) {
  try {
    return formatDistanceToNowStrict(new Date(summary.date), { addSuffix: true });
  } catch {
    return summary.pr?.opened ?? "recently";
  }
}

function reliabilityDot(score: number) {
  if (score > 85) {
    return "bg-emerald-400";
  }
  if (score >= 65) {
    return "bg-yellow-400";
  }
  return "bg-red-400";
}

function priorityWeight(priority?: "critical" | "high" | "medium") {
  if (priority === "critical") {
    return 0;
  }
  if (priority === "high") {
    return 1;
  }
  return 2;
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
  const [checklistState, setChecklistState] = useState(() => normalizeChecklist(summary));

  useEffect(() => {
    setChecklistState(normalizeChecklist(summary));
  }, [summary]);

  const structured = useMemo(() => buildStructuredSummary(summary), [summary]);
  const whatChanged = useMemo(() => normalizeWhatChanged(summary), [summary]);
  const insights = useMemo(() => normalizeInsights(summary), [summary]);

  const risk = summary.risk ?? {
    level: isSecurityTitle(summary.prTitle) ? "high" : "medium",
    reason: isSecurityTitle(summary.prTitle)
      ? "Security-critical files modified — manual review strongly recommended"
      : "Core modules changed — verify behavior under production-like load",
  };

  const totalAdditions = whatChanged.reduce((acc, item) => acc + item.additions, 0);
  const totalDeletions = whatChanged.reduce((acc, item) => acc + item.deletions, 0);

  const metadata = summary.pr ?? {
    title: summary.prTitle,
    author: summary.author ?? "unknown",
    number: summary.prNumber,
    repo: summary.repoName,
    branch_from: "feature/unknown",
    branch_to: "main",
    status: "open" as const,
    opened: renderOpenedTime(summary),
    files_changed: whatChanged.length,
    additions: totalAdditions,
    deletions: totalDeletions,
    description: "No PR description available.",
  };

  const breakdown = whatChanged.reduce(
    (acc, item) => {
      acc[item.type] += 1;
      return acc;
    },
    { feat: 0, fix: 0, refactor: 0, chore: 0 }
  );
  const totalForBreakdown = Math.max(1, whatChanged.length);

  const sortedChecklist = [...checklistState].sort((a, b) => {
    if (a.checked !== b.checked) {
      return a.checked ? 1 : -1;
    }
    return priorityWeight(a.priority) - priorityWeight(b.priority);
  });

  const completed = checklistState.filter((item) => item.checked).length;
  const checklistPercent = Math.round((completed / Math.max(1, checklistState.length)) * 100);
  const allChecklistDone = checklistState.length > 0 && completed === checklistState.length;

  const toggleCheck = (id: string) => {
    setChecklistState((current) =>
      current.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const copyFullSummary = async () => {
    const markdown = buildMarkdown(summary, structured, whatChanged);
    await navigator.clipboard.writeText(markdown);
    toast.success("Copied! ✓");
  };

  const exportMarkdown = () => {
    const markdown = buildMarkdown(summary, structured, whatChanged);
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

  const diffFiles = whatChanged
    .filter((item) => Boolean(item.diff))
    .map((item) => ({ filename: item.filename, diff: item.diff ?? "" }));

  return (
    <div className="space-y-6 pb-24">
      <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: "0ms" }}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-wide text-foreground">{metadata.title}</h3>
              <p className="text-xs text-muted-foreground">@{metadata.author}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {(metadata.description ?? "").slice(0, 100)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isSecurityTitle(metadata.title) && (
                <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-300">
                  🔒 Security Fix
                </Badge>
              )}
              <Badge
                variant="outline"
                className={
                  metadata.status === "open"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : metadata.status === "merged"
                      ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
                      : "border-red-500/40 bg-red-500/10 text-red-300"
                }
              >
                <CircleDot className="mr-1 h-3 w-3" />
                {metadata.status[0].toUpperCase() + metadata.status.slice(1)}
              </Badge>
            </div>
          </div>

          <div className="rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
            {metadata.branch_from} <span className="mx-1 text-cyan-300">-&gt;</span> {metadata.branch_to}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>#{metadata.number}</span>
            <span>{metadata.files_changed} files changed</span>
            <span className="font-mono text-green-400">+{metadata.additions}</span>
            <span className="font-mono text-red-400">-{metadata.deletions}</span>
            <span>{renderOpenedTime(summary)}</span>
          </div>
        </CardContent>
      </Card>

      <StructuredSummaryCard
        summary={structured}
        riskLevel={risk.level}
        riskReason={risk.reason}
        animationDelay={50}
      />

      <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: "100ms" }}>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <GitCommit className="h-4 w-4 text-primary" />
          <CardTitle className="text-base tracking-wide">What Changed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {whatChanged.map((item, index) => (
            <FileSummaryCard key={`${item.filename}-${index}`} item={item} animationDelay={index * 50} />
          ))}
        </CardContent>
      </Card>

      <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: "150ms" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base tracking-wide">Change Type Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-3 overflow-hidden rounded-full border border-border bg-background">
            <div className="flex h-full w-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="bg-gradient-to-r from-emerald-500/90 to-emerald-300/80"
                    style={{ width: `${(breakdown.feat / totalForBreakdown) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>feat: {breakdown.feat} ({Math.round((breakdown.feat / totalForBreakdown) * 100)}%)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="bg-gradient-to-r from-red-500/90 to-red-300/80"
                    style={{ width: `${(breakdown.fix / totalForBreakdown) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>fix: {breakdown.fix} ({Math.round((breakdown.fix / totalForBreakdown) * 100)}%)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="bg-gradient-to-r from-blue-500/90 to-blue-300/80"
                    style={{ width: `${(breakdown.refactor / totalForBreakdown) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>refactor: {breakdown.refactor} ({Math.round((breakdown.refactor / totalForBreakdown) * 100)}%)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="bg-gradient-to-r from-yellow-500/90 to-yellow-300/80"
                    style={{ width: `${(breakdown.chore / totalForBreakdown) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>chore: {breakdown.chore} ({Math.round((breakdown.chore / totalForBreakdown) * 100)}%)</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>feat {breakdown.feat} ({Math.round((breakdown.feat / totalForBreakdown) * 100)}%)</span>
            <span>fix {breakdown.fix} ({Math.round((breakdown.fix / totalForBreakdown) * 100)}%)</span>
            <span>refactor {breakdown.refactor} ({Math.round((breakdown.refactor / totalForBreakdown) * 100)}%)</span>
            <span>chore {breakdown.chore} ({Math.round((breakdown.chore / totalForBreakdown) * 100)}%)</span>
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: "200ms" }}>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <FileCode className="h-4 w-4 text-primary" />
          <CardTitle className="text-base tracking-wide">Files Affected</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {whatChanged.map((item) => {
              const score = item.reliability ?? 0;
              return (
                <li
                  key={item.filename}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:border-[#2a2a2a]"
                  onClick={() => {
                    document.getElementById(`file-card-${encodeURIComponent(item.filename)}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  <ChangeTypeBadge type={item.type} />
                  <span className="font-mono text-xs text-foreground">{item.filename}</span>
                  <span className="ml-auto font-mono text-xs">
                    <span className="text-green-400">+{item.additions}</span>{" "}
                    <span className="text-red-400">-{item.deletions}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className={cn("h-2 w-2 rounded-full", reliabilityDot(score))} />
                    {score}%
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: "250ms" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base tracking-wide">AI Insights & Warnings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {insights.map((item, index) => (
            <InsightItem key={`${item.type}-${index}`} insight={item} />
          ))}
        </CardContent>
      </Card>

      <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: "300ms" }}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base tracking-wide">Review Checklist</CardTitle>
          <span className="text-xs text-muted-foreground">
            {completed}/{checklistState.length} completed
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={checklistPercent} className="h-2 bg-secondary" />
          {allChecklistDone && (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              All done! ✓
            </p>
          )}
          <ul className="space-y-2.5">
            {sortedChecklist.map((item) => (
              <ChecklistItem key={item.id} item={item} onToggle={toggleCheck} />
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: "350ms" }}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-base tracking-wide">Changelog Entry</CardTitle>
          </div>
          <CopyButton text={summary.changelog} label="Copy" />
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="overflow-x-auto rounded-md border border-border bg-background p-4 font-mono text-xs leading-relaxed">
            {summary.changelog.split("\n").map((line, index) => (
              <div
                key={`${line}-${index}`}
                className={cn(
                  line.startsWith("##") && "text-cyan-300",
                  line.startsWith("###") && "text-emerald-300",
                  line.startsWith("-") && "text-muted-foreground"
                )}
              >
                {line || " "}
              </div>
            ))}
          </pre>
          <p className="text-xs text-muted-foreground">Uses conventional commits style sections for release readiness.</p>
        </CardContent>
      </Card>

      <DiffViewer
        files={diffFiles.length > 0 ? diffFiles : [{ filename: whatChanged[0]?.filename ?? "pull-request.diff", diff: summary.rawDiff ?? "" }]}
        prUrl={summary.prUrl}
        animationDelay={400}
      />

      <div className="sticky bottom-0 z-20 card-enter rounded-md border border-border bg-card/95 p-3 backdrop-blur" style={{ animationDelay: "450ms" }}>
        <Separator className="mb-3 bg-border" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Button variant="outline" size="sm" className="gap-2 active:scale-95 transition-transform" onClick={copyFullSummary}>
            <Clipboard className="h-3.5 w-3.5" /> Copy Full Summary
          </Button>
          <Button variant="outline" size="sm" className="gap-2 active:scale-95 transition-transform" onClick={exportMarkdown}>
            <FileDown className="h-3.5 w-3.5" /> Export as Markdown
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 active:scale-95 transition-transform"
            onClick={() => {
              if (onSaveToHistory) {
                onSaveToHistory();
                return;
              }
              toast.success("Summary is already saved to history");
            }}
          >
            <Save className="h-3.5 w-3.5" /> Save to History
          </Button>
          <Button variant="outline" size="sm" className="gap-2 active:scale-95 transition-transform" onClick={onResummarize}>
            <RefreshCcw className="h-3.5 w-3.5" /> Re-summarize
          </Button>
        </div>
      </div>
    </div>
  );
}
