import { PRSummary } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangeTypeBadge } from "@/components/ChangeTypeBadge";
import { CopyButton } from "@/components/CopyButton";
import { Checkbox } from "@/components/ui/checkbox";
import { FileCode, ListChecks, FileText, GitCommit, BookOpen, GitBranch } from "lucide-react";
import { useState } from "react";

export function SummaryOutput({ summary }: { summary: PRSummary }) {
  const [checklist, setChecklist] = useState(summary.checklist);

  const toggleCheck = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="animate-fade-in border-border bg-card">
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground">{summary.summary}</p>
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
      <Card className="animate-fade-in border-border bg-card" style={{ animationDelay: "0.4s" }}>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <ListChecks className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Review Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <Checkbox
                  checked={item.checked}
                  onCheckedChange={() => toggleCheck(item.id)}
                  id={item.id}
                />
                <label
                  htmlFor={item.id}
                  className={`text-sm cursor-pointer ${item.checked ? "text-muted-foreground line-through" : "text-foreground"}`}
                >
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 animate-fade-in" style={{ animationDelay: "0.5s" }}>
        <CopyButton text={summary.summary} label="Copy Summary" />
        <CopyButton text={summary.changelog} label="Copy Changelog" />
      </div>
    </div>
  );
}
