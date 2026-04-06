import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChecklistItem as ChecklistItemType, ChecklistPriority } from "@/types";
import { cn } from "@/lib/utils";

const priorityStyle: Record<ChecklistPriority, string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-300",
  high: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  medium: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
};

export function ChecklistItem({
  item,
  onToggle,
}: {
  item: ChecklistItemType;
  onToggle: (id: string) => void;
}) {
  const priority = item.priority ?? "medium";

  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 transition-colors",
        item.checked && "opacity-80"
      )}
    >
      <Checkbox
        checked={item.checked}
        onCheckedChange={() => onToggle(item.id)}
        id={`check-${item.id}`}
        className="mt-0.5 transition-transform data-[state=checked]:scale-110 data-[state=checked]:border-green-500 data-[state=checked]:bg-green-500"
      />
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`check-${item.id}`}
            className={cn(
              "cursor-pointer text-sm leading-relaxed text-foreground",
              item.checked && "line-through text-muted-foreground"
            )}
          >
            {item.label}
          </label>
          <Badge variant="outline" className={priorityStyle[priority]}>
            {priority}
          </Badge>
        </div>
      </div>
    </li>
  );
}
