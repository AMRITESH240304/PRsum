import { Compass } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type NavItem = {
  id: string;
  label: string;
};

export function QuickNav({
  items,
  activeId,
  onJump,
}: {
  items: NavItem[];
  activeId: string;
  onJump: (id: string) => void;
}) {
  return (
    <Card className="card-elevated border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <CardTitle className="text-base font-semibold">Jump To</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onJump(item.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
              activeId === item.id
                ? "border border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                : "border border-transparent bg-background text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            <span>{item.label}</span>
            {activeId === item.id && <span className="text-xs">active</span>}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
