import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ShortcutItem = {
  keys: string;
  description: string;
};

const SHORTCUT_ITEMS: ShortcutItem[] = [
  { keys: "Cmd+K", description: "Focus GitHub URL input" },
  { keys: "Cmd+Enter", description: "Summarize" },
  { keys: "Cmd+C", description: "Copy full summary" },
  { keys: "Cmd+E", description: "Export markdown" },
  { keys: "?", description: "Open shortcuts help" },
];

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }
  return element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable;
}

export function KeyboardShortcuts({
  onFocusGithub,
  onSummarize,
  onCopy,
  onExport,
  canUseSummaryActions,
}: {
  onFocusGithub: () => void;
  onSummarize: () => void;
  onCopy: () => void;
  onExport: () => void;
  canUseSummaryActions: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setOpen(true);
        return;
      }

      if (!event.metaKey) {
        return;
      }

      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        onFocusGithub();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        onSummarize();
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key.toLowerCase() === "c" && canUseSummaryActions) {
        event.preventDefault();
        onCopy();
        return;
      }

      if (event.key.toLowerCase() === "e" && canUseSummaryActions) {
        event.preventDefault();
        onExport();
      }
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [canUseSummaryActions, onCopy, onExport, onFocusGithub, onSummarize]);

  return (
    <>
      <button
        type="button"
        className="w-full rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        Press ? for shortcuts
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>Use these shortcuts while reviewing a PR summary.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {SHORTCUT_ITEMS.map((item) => (
              <div key={item.keys} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm">
                <span className="text-muted-foreground">{item.description}</span>
                <kbd className="rounded border border-border bg-card px-2 py-0.5 font-mono text-xs text-cyan-300">
                  {item.keys}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
