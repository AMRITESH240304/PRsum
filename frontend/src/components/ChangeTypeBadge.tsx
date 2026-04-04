import { Badge } from "@/components/ui/badge";
import { ChangeType } from "@/types";
import { cn } from "@/lib/utils";

const typeConfig: Record<ChangeType, { emoji: string; label: string; className: string }> = {
  feat: { emoji: "🟢", label: "feat", className: "bg-feat/15 text-feat border-feat/30" },
  fix: { emoji: "🔴", label: "fix", className: "bg-fix/15 text-fix border-fix/30" },
  refactor: { emoji: "🔵", label: "refactor", className: "bg-refactor/15 text-refactor border-refactor/30" },
  chore: { emoji: "🟡", label: "chore", className: "bg-chore/15 text-chore border-chore/30" },
};

export function ChangeTypeBadge({ type }: { type: ChangeType }) {
  const config = typeConfig[type];
  return (
    <Badge variant="outline" className={cn("font-mono text-xs", config.className)}>
      {config.emoji} {config.label}
    </Badge>
  );
}
