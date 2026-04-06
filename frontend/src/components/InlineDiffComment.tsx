import { useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function InlineDiffComment({
  annotation,
  editing,
  onStart,
  onSave,
  onCancel,
}: {
  annotation?: string;
  editing: boolean;
  onStart: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(annotation ?? "");

  useEffect(() => {
    setDraft(annotation ?? "");
  }, [annotation]);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSave(draft.trim());
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
          placeholder="Add annotation"
          className="h-7 w-52 border-border bg-background font-mono text-[11px]"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px]"
          onClick={() => onSave(draft.trim())}
        >
          Save
        </Button>
      </div>
    );
  }

  if (annotation) {
    return (
      <button
        type="button"
        className="rounded border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-[11px] text-yellow-200"
        onClick={onStart}
        title={annotation}
      >
        {annotation.length > 34 ? `${annotation.slice(0, 34)}...` : annotation}
      </button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="rounded border border-border bg-background/60 px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={onStart}
        >
          <span className="inline-flex items-center gap-1">
            <MessageSquarePlus className="h-3 w-3" /> Note
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>Click to annotate this line</TooltipContent>
    </Tooltip>
  );
}
