import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/hooks/use-store";
import { removeFromHistory } from "@/store/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChangeTypeBadge } from "@/components/ChangeTypeBadge";
import { Search, Trash2, ChevronDown, ChevronUp, Inbox } from "lucide-react";
import { toast } from "sonner";

export default function History() {
  const { history } = useAppStore();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = history.filter(
    (s) =>
      s.repoName.toLowerCase().includes(search.toLowerCase()) ||
      s.prTitle.toLowerCase().includes(search.toLowerCase()) ||
      s.summary.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-3xl py-6">
        <h1 className="mb-6 text-2xl font-bold text-foreground">History</h1>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by repo, title, or keyword..."
            className="border-border bg-surface pl-10 font-mono text-sm"
          />
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Inbox className="mb-4 h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {search ? "No results found" : "No summaries saved yet"}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((item) => (
            <Card
              key={item.id}
              className="border-border bg-card transition-colors hover:border-primary/20"
            >
              <CardHeader
                className="cursor-pointer pb-2"
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{item.repoName}</span>
                      <span>#{item.prNumber}</span>
                      <span>·</span>
                      <span>{new Date(item.date).toLocaleDateString()}</span>
                    </div>
                    <CardTitle className="mt-1 text-sm">{item.prTitle}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromHistory(item.id);
                        toast.success("Removed from history");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {expanded === item.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {expanded === item.id && (
                <CardContent className="animate-fade-in space-y-4 pt-0">
                  <p className="text-sm text-foreground">{item.summary}</p>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Changes</p>
                    {item.changes.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <ChangeTypeBadge type={c.type} />
                        <span className="text-foreground">{c.description}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Files</p>
                    {item.filesAffected.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <ChangeTypeBadge type={f.changeType} />
                        <code className="font-mono text-foreground">{f.filename}</code>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
