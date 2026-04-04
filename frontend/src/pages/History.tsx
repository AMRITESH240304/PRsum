import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChangeTypeBadge } from "@/components/ChangeTypeBadge";
import { Search, Trash2, ChevronDown, ChevronUp, Inbox } from "lucide-react";
import { toast } from "sonner";
import { fetchHistory, deleteHistoryItem } from "@/lib/api";
import { useAppStore } from "@/hooks/use-store";
import { PRSummary } from "@/types";

export default function History() {
  const { credential, user } = useAppStore();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<PRSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!credential || !user) {
      setHistory([]);
      return;
    }

    setLoading(true);
    setError(null);

    fetchHistory(credential)
      .then(setHistory)
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load history");
        toast.error("Failed to load saved summaries");
      })
      .finally(() => setLoading(false));
  }, [credential, user]);

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

        {!user && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Sign in with Google to see your persisted PR history.
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
            {error}
          </div>
        )}

        {loading && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Loading saved summaries...
          </div>
        )}

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
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!credential) {
                          toast.error("Sign in again to delete history items");
                          return;
                        }

                        try {
                          await deleteHistoryItem(credential, item.id);
                          setHistory((current) => current.filter((summary) => summary.id !== item.id));
                          toast.success("Removed from history");
                        } catch (deleteError) {
                          toast.error(deleteError instanceof Error ? deleteError.message : "Failed to delete item");
                        }
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
