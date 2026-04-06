import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChangeTypeBadge } from "@/components/ChangeTypeBadge";
import { ReliabilityBar } from "@/components/ReliabilityBar";
import { WhatChangedItem } from "@/types";
import { cn } from "@/lib/utils";

type DiffLine = {
  content: string;
  kind: "add" | "remove" | "other";
};

function parseInlineDiff(diff: string): DiffLine[] {
  return diff
    .split("\n")
    .slice(0, 60)
    .map((line) => ({
      content: line,
      kind: line.startsWith("+") ? "add" : line.startsWith("-") ? "remove" : "other",
    }));
}

export function FileSummaryCard({
  item,
  animationDelay,
}: {
  item: WhatChangedItem;
  animationDelay?: number;
}) {
  const [open, setOpen] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const diffLines = useMemo(() => parseInlineDiff(item.diff ?? ""), [item.diff]);
  const preview = item.what.length > 150 ? `${item.what.slice(0, 150)}...` : item.what;

  return (
    <Card
      id={`file-card-${encodeURIComponent(item.filename)}`}
      className="card-elevated card-enter border-border bg-card"
      style={{ animationDelay: `${animationDelay ?? 0}ms` }}
    >
      <CardHeader className="cursor-pointer pb-2" onClick={() => setOpen((current) => !current)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ChangeTypeBadge type={item.type} />
            <span className="font-mono text-xs text-foreground">{item.filename}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs">
              <span className="text-green-400">+{item.additions}</span>{" "}
              <span className="text-red-400">-{item.deletions}</span>
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </div>
        </div>
        {!open && <p className="pt-2 text-sm text-muted-foreground">{preview}</p>}
      </CardHeader>

      {open && (
        <CardContent className="space-y-3 border-t border-border pt-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-cyan-300">What changed</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{item.what}</p>
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-wide text-cyan-300">Key changes</p>
            <ul className="mt-1 space-y-1 text-sm text-foreground">
              {item.keyChanges.map((change, index) => (
                <li key={`${item.filename}-${index}`} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>

          <ReliabilityBar reliability={item.reliability ?? 60} />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-0 font-mono text-xs text-cyan-300 hover:text-cyan-200"
            onClick={() => setShowDiff((current) => !current)}
          >
            {showDiff ? "Hide Diff ↑" : "View Diff ↓"}
          </Button>

          {showDiff && (
            <div className="max-h-56 overflow-auto rounded-md border border-border bg-[#0d0d0d] font-mono text-xs">
              {diffLines.length === 0 ? (
                <p className="px-3 py-2 text-muted-foreground">Diff not available for this file.</p>
              ) : (
                diffLines.map((line, index) => (
                  <div
                    key={`${item.filename}-${index}`}
                    className={cn(
                      "px-3 py-1.5 whitespace-pre-wrap",
                      line.kind === "add" && "bg-[#003d00]",
                      line.kind === "remove" && "bg-[#3d0000]"
                    )}
                  >
                    {line.content || " "}
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
