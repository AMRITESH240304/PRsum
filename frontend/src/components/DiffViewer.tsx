import { useMemo, useState } from "react";
import { ExternalLink, GitBranch } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/CopyButton";
import { cn } from "@/lib/utils";

type DiffFile = {
  filename: string;
  diff: string;
};

type ParsedDiffLine = {
  oldLine: number | null;
  newLine: number | null;
  content: string;
  kind: "add" | "remove" | "context" | "meta";
};

function parseDiff(diff: string): ParsedDiffLine[] {
  const lines = diff.split("\n");
  const parsed: ParsedDiffLine[] = [];

  let oldLineNumber = 0;
  let newLineNumber = 0;

  for (const rawLine of lines) {
    if (rawLine.startsWith("@@")) {
      const match = rawLine.match(/@@\s*-(\d+)(?:,\d+)?\s*\+(\d+)(?:,\d+)?\s*@@/);
      if (match) {
        oldLineNumber = Number(match[1]);
        newLineNumber = Number(match[2]);
      }
      parsed.push({ oldLine: null, newLine: null, content: rawLine, kind: "meta" });
      continue;
    }

    if (rawLine.startsWith("diff --git") || rawLine.startsWith("index ") || rawLine.startsWith("---") || rawLine.startsWith("+++")) {
      parsed.push({ oldLine: null, newLine: null, content: rawLine, kind: "meta" });
      continue;
    }

    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      parsed.push({ oldLine: null, newLine: newLineNumber++, content: rawLine, kind: "add" });
      continue;
    }

    if (rawLine.startsWith("-") && !rawLine.startsWith("---")) {
      parsed.push({ oldLine: oldLineNumber++, newLine: null, content: rawLine, kind: "remove" });
      continue;
    }

    parsed.push({ oldLine: oldLineNumber++, newLine: newLineNumber++, content: rawLine, kind: "context" });
  }

  return parsed;
}

export function DiffViewer({
  files,
  prUrl,
  animationDelay,
}: {
  files: DiffFile[];
  prUrl?: string;
  animationDelay?: number;
}) {
  const [activeFile, setActiveFile] = useState(0);

  const active = files[activeFile];
  const parsedLines = useMemo(() => parseDiff(active?.diff ?? ""), [active]);

  if (!active || !active.diff) {
    return (
      <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: `${animationDelay ?? 0}ms` }}>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <GitBranch className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Git Diff</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            Diff not available. GitHub API returned patch-less response for this change. View the full diff on GitHub.
          </p>
          {prUrl && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <a href={prUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Open full diff on GitHub
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated card-enter border-border bg-card" style={{ animationDelay: `${animationDelay ?? 0}ms` }}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Git Diff</CardTitle>
          </div>
          <CopyButton text={active.diff} label="Copy Diff" />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {files.map((file, index) => (
            <button
              key={`${file.filename}-${index}`}
              type="button"
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-xs transition-colors",
                index === activeFile
                  ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-200"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveFile(index)}
            >
              {file.filename}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[420px] overflow-auto rounded-md border border-border bg-[#0e0e0e]">
          <table className="w-full border-collapse font-mono text-xs">
            <tbody>
              {parsedLines.map((line, index) => (
                <tr
                  key={`${line.content}-${index}`}
                  className={cn(
                    line.kind === "add" && "bg-[#003d00]",
                    line.kind === "remove" && "bg-[#3d0000]",
                    line.kind === "meta" && "bg-[#121212] text-cyan-200"
                  )}
                >
                  <td className="w-10 select-none border-r border-border px-2 text-right text-muted-foreground">
                    {line.oldLine ?? ""}
                  </td>
                  <td className="w-10 select-none border-r border-border px-2 text-right text-muted-foreground">
                    {line.newLine ?? ""}
                  </td>
                  <td className="whitespace-pre-wrap px-3 py-1.5 text-foreground">{line.content || " "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
