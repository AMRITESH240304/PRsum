import { StickyNote } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function FileNoteOverlay({ note }: { note: string }) {
  const preview = note.length > 42 ? `${note.slice(0, 42)}...` : note;

  return (
    <Badge
      variant="outline"
      title={note}
      className="max-w-[220px] gap-1 border-yellow-500/40 bg-yellow-500/15 text-yellow-200"
    >
      <StickyNote className="h-3 w-3" />
      <span className="truncate text-[11px]">{preview}</span>
    </Badge>
  );
}
