import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { CircleDot, FileCode, FileText, GitCommit } from "lucide-react";

import { PRSummary, SummaryTone, ChecklistItem as ChecklistItemType } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChangeTypeBadge } from "@/components/ChangeTypeBadge";
import { CopyButton } from "@/components/CopyButton";
import { StructuredSummaryCard } from "@/components/StructuredSummary";
import { FileSummaryCard } from "@/components/FileSummaryCard";
import { InsightItem } from "@/components/InsightItem";
import { ChecklistItem } from "@/components/ChecklistItem";
import { DiffViewer } from "@/components/DiffViewer";
import { PRHealthScore } from "@/components/PRHealthScore";
import { cn } from "@/lib/utils";
import { getRisk, getToneStructuredSummary, normalizeWhatChanged } from "@/lib/summary-utils";

function normalizeInsights(summary: PRSummary) {
  const raw = summary.insights ?? [];
  const sanitized = raw
    .map((item) => {
      if (/failed|error|traceback|exception/i.test(item.text)) {
        return {
          type: "warning" as const,
          text: "Manual review recommended for this PR.",
        };
      }
      return item;
    })
    .filter(
      (item, index, all) =>
        all.findIndex((entry) => entry.text === item.text && entry.type === item.type) === index
    );

  if (sanitized.length === 0) {
    return [{ type: "warning" as const, text: "Manual review recommended for this PR." }];
  }

  return sanitized;
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

function normalizeChecklist(summary: PRSummary): ChecklistItemType[] {
  const fromSummary =
    summary.checklist.length > 0
      ? summary.checklist
      : [
          { id: "1", label: "Review changed file behavior against expected runtime flow", checked: false },
          { id: "2", label: "Run targeted tests for impacted modules and endpoints", checked: false },
          { id: "3", label: "Validate no breaking API contract changes were introduced", checked: false },
        ];

  return fromSummary.map((item) => ({
    ...item,
    priority: item.priority ?? inferChecklistPriority(item.label),
  }));
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

function reliabilityDot(score: number) {
  if (score > 85) {
    return "bg-emerald-400";
  }
  if (score >= 65) {
    return "bg-yellow-400";
  }
  return "bg-red-400";
}

function renderOpenedTime(summary: PRSummary) {
  try {
    return formatDistanceToNowStrict(new Date(summary.date), { addSuffix: true });
  } catch {
    return summary.pr?.opened ?? "recently";
  }
}

function SectionDivider() {
  return <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />;
}

export function SummaryOutput({
  summary,
  tone,
}: {
  summary: PRSummary;
  tone: SummaryTone;
}) {
  const whatChanged = useMemo(() => normalizeWhatChanged(summary), [summary]);
  const structured = useMemo(() => getToneStructuredSummary(summary, tone), [summary, tone]);
  const insights = useMemo(() => normalizeInsights(summary), [summary]);

  const [checklistState, setChecklistState] = useState(() => normalizeChecklist(summary));
  const [openFiles, setOpenFiles] = useState<Record<string, boolean>>({});
  const [fileNotes, setFileNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    setChecklistState(normalizeChecklist(summary));
  }, [summary]);

  useEffect(() => {
    setOpenFiles(Object.fromEntries(whatChanged.map((item) => [item.filename, false])));
    setFileNotes({});
  }, [summary.id, whatChanged]);

  const risk = getRisk(summary);

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

  const expandAllFiles = () => {
    setOpenFiles(Object.fromEntries(whatChanged.map((item) => [item.filename, true])));
  };

  const collapseAllFiles = () => {
    setOpenFiles(Object.fromEntries(whatChanged.map((item) => [item.filename, false])));
  };

  const toggleFile = (filename: string) => {
    setOpenFiles((current) => ({
      ...current,
      [filename]: !current[filename],
    }));
  };

  const saveNote = (filename: string, note: string) => {
    setFileNotes((current) => {
      const next = { ...current };
      if (!note) {
        delete next[filename];
        return next;
      }
      next[filename] = note;
      return next;
    });
  };

  const diffFiles = whatChanged
    .filter((item) => Boolean(item.diff))
    .map((item) => ({ filename: item.filename, diff: item.diff ?? "" }));

  return (
    <div className="space-y-8 pb-12">
      <PRHealthScore summary={summary} />

      <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: "0ms" }}>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-wide text-foreground">{metadata.title}</h3>
              <p className="text-xs text-muted-foreground">@{metadata.author}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{(metadata.description ?? "").slice(0, 130)}</p>
            </div>
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

      <SectionDivider />

      <section id="section-summary" className="scroll-mt-24">
        <div key={`${summary.id}-${tone}`} className="summary-tone-fade">
          <StructuredSummaryCard
            summary={structured}
            riskLevel={risk.level}
            riskReason={risk.reason}
            animationDelay={50}
          />
        </div>
      </section>

      <SectionDivider />

      <section id="section-what-changed" className="scroll-mt-24">
        <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: "100ms" }}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div className="flex items-center gap-2">
              <GitCommit className="h-4 w-4 text-primary" />
              <CardTitle className="text-[16px] font-semibold tracking-wide">What Changed</CardTitle>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={collapseAllFiles}
              >
                Collapse All
              </button>
              <button
                type="button"
                className="rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={expandAllFiles}
              >
                Expand All
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            {whatChanged.map((item, index) => (
              <FileSummaryCard
                key={`${item.filename}-${index}`}
                item={item}
                isOpen={Boolean(openFiles[item.filename])}
                onToggle={toggleFile}
                note={fileNotes[item.filename]}
                onSaveNote={saveNote}
                animationDelay={index * 40}
              />
            ))}
          </CardContent>
        </Card>
      </section>

      <SectionDivider />

      <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: "150ms" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-[16px] font-semibold tracking-wide">Change Type Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          <div className="h-3 overflow-hidden rounded-full border border-border bg-background">
            <div className="flex h-full w-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="bg-gradient-to-r from-emerald-500/90 to-emerald-300/80"
                    style={{ width: `${(breakdown.feat / totalForBreakdown) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  feat: {breakdown.feat} ({Math.round((breakdown.feat / totalForBreakdown) * 100)}%)
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="bg-gradient-to-r from-red-500/90 to-red-300/80"
                    style={{ width: `${(breakdown.fix / totalForBreakdown) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  fix: {breakdown.fix} ({Math.round((breakdown.fix / totalForBreakdown) * 100)}%)
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="bg-gradient-to-r from-blue-500/90 to-blue-300/80"
                    style={{ width: `${(breakdown.refactor / totalForBreakdown) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  refactor: {breakdown.refactor} ({Math.round((breakdown.refactor / totalForBreakdown) * 100)}%)
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="bg-gradient-to-r from-yellow-500/90 to-yellow-300/80"
                    style={{ width: `${(breakdown.chore / totalForBreakdown) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  chore: {breakdown.chore} ({Math.round((breakdown.chore / totalForBreakdown) * 100)}%)
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>feat {breakdown.feat}</span>
            <span>fix {breakdown.fix}</span>
            <span>refactor {breakdown.refactor}</span>
            <span>chore {breakdown.chore}</span>
          </div>
        </CardContent>
      </Card>

      <SectionDivider />

      <section id="section-files-affected" className="scroll-mt-24">
        <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: "200ms" }}>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <FileCode className="h-4 w-4 text-primary" />
            <CardTitle className="text-[16px] font-semibold tracking-wide">Files Affected</CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <ul className="space-y-2">
              {whatChanged.map((item) => {
                const score = item.reliability ?? 0;
                return (
                  <li
                    key={item.filename}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:border-[#2a2a2a]"
                    onClick={() => {
                      document
                        .getElementById(`file-card-${encodeURIComponent(item.filename)}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "center" });
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
      </section>

      <SectionDivider />

      <section id="section-insights" className="scroll-mt-24">
        <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: "250ms" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-[16px] font-semibold tracking-wide">AI Insights & Warnings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 p-5 pt-0">
            {insights.map((item, index) => (
              <InsightItem key={`${item.type}-${index}`} insight={item} />
            ))}
          </CardContent>
        </Card>
      </section>

      <SectionDivider />

      <section id="section-checklist" className="scroll-mt-24">
        <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: "300ms" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-[16px] font-semibold tracking-wide">Review Checklist</CardTitle>
            <span className="text-xs text-muted-foreground">
              {completed}/{checklistState.length} completed
            </span>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            <Progress value={checklistPercent} className="h-2 bg-secondary" />
            {allChecklistDone && (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                All done
              </p>
            )}
            <ul className="space-y-2.5">
              {sortedChecklist.map((item) => (
                <ChecklistItem key={item.id} item={item} onToggle={toggleCheck} />
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <SectionDivider />

      <section id="section-changelog" className="scroll-mt-24">
        <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: "350ms" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <CardTitle className="text-[16px] font-semibold tracking-wide">Changelog Entry</CardTitle>
            </div>
            <CopyButton text={summary.changelog} label="Copy" />
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
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
            <p className="text-xs text-muted-foreground">
              Uses conventional commit style sections for release readiness.
            </p>
          </CardContent>
        </Card>
      </section>

      <SectionDivider />

      <section id="section-git-diff" className="scroll-mt-24">
        <DiffViewer
          files={
            diffFiles.length > 0
              ? diffFiles
              : [{ filename: whatChanged[0]?.filename ?? "pull-request.diff", diff: summary.rawDiff ?? "" }]
          }
          prUrl={summary.prUrl}
          animationDelay={400}
        />
      </section>
    </div>
  );
}
