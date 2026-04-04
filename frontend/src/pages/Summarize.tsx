import { useMemo, useState, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileDropZone } from "@/components/FileDropZone";
import { SummaryOutput } from "@/components/SummaryOutput";
import { OutputSkeleton } from "@/components/OutputSkeleton";
import { mockDiff } from "@/lib/mock-data";
import { PRSummary } from "@/types";
import { streamSummary } from "@/lib/api";
import { useAppStore } from "@/hooks/use-store";
import { Sparkles, Github, FileText, Upload, Terminal, GitCommitHorizontal, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

type StreamedFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string | null;
};

export default function Summarize() {
  const { credential, user } = useAppStore();
  const [diffInput, setDiffInput] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PRSummary | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [files, setFiles] = useState<StreamedFile[]>([]);

  const handleSummarize = useCallback(async () => {
    if (!credential || !user) {
      toast.error("Sign in with Google before summarizing a PR");
      return;
    }

    if (!diffInput.trim() && !githubUrl.trim()) {
      toast.error("Paste a diff or enter a GitHub PR URL");
      return;
    }

    setLoading(true);
    setResult(null);
    setProgress([]);
    setFiles([]);
    setStreamError(null);

    try {
      const summary = await streamSummary(
        credential,
        {
          pr_url: githubUrl.trim() || undefined,
          diff_text: diffInput.trim() || undefined,
        },
        {
          onStage: (message) => setProgress((current) => [...current, message]),
          onFile: (file) => setFiles((current) => [...current, file]),
          onSummary: (payload) => setResult(payload),
          onError: (message) => setStreamError(message),
        }
      );

      if (summary) {
        setResult(summary);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to summarize PR";
      setStreamError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [credential, diffInput, githubUrl, user]);

  const handleFileUpload = useCallback((content: string, _name: string) => {
    setDiffInput(content);
  }, []);

  const hasInput = useMemo(
    () => diffInput.trim().length > 0 || githubUrl.trim().length > 0,
    [diffInput, githubUrl]
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* LEFT PANEL — Input */}
          <div className="flex flex-col gap-4">
            {!user && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground">
                <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-500" />
                <p>Sign in with Google to persist summaries and history across sessions.</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Input</h2>
            </div>

            <Tabs defaultValue="paste" className="w-full">
              <TabsList className="w-full bg-surface">
                <TabsTrigger value="paste" className="flex-1 gap-1.5 data-[state=active]:bg-card">
                  <FileText className="h-3.5 w-3.5" /> Paste Diff
                </TabsTrigger>
                <TabsTrigger value="github" className="flex-1 gap-1.5 data-[state=active]:bg-card">
                  <Github className="h-3.5 w-3.5" /> GitHub URL
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex-1 gap-1.5 data-[state=active]:bg-card">
                  <Upload className="h-3.5 w-3.5" /> Upload File
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paste">
                <Textarea
                  value={diffInput}
                  onChange={(e) => setDiffInput(e.target.value)}
                  placeholder={mockDiff}
                  className="min-h-[400px] resize-none rounded-lg border-border bg-surface font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/40"
                />
              </TabsContent>

              <TabsContent value="github">
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
                  <label className="text-sm font-medium text-foreground">
                    Pull Request URL
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/user/repo/pull/42"
                      className="border-border bg-card font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The backend fetches the diff, comments, and reviews from GitHub.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="upload">
                <div className="relative">
                  <FileDropZone onFile={handleFileUpload} />
                </div>
              </TabsContent>
            </Tabs>

            <Button
              size="lg"
              className="w-full gap-2 glow-accent font-medium"
              onClick={handleSummarize}
              disabled={!hasInput || loading || !credential}
            >
              <Sparkles className="h-4 w-4" />
              {loading ? "Analyzing..." : "Summarize"}
            </Button>

            {loading && (
              <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <GitCommitHorizontal className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Live progress</h3>
                </div>
                <div className="space-y-2">
                  {progress.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Waiting for stream events...</p>
                  ) : (
                    progress.map((item, index) => (
                      <div key={`${item}-${index}`} className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground">
                        {item}
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Agent file scan
                  </p>
                  {files.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Waiting for file events...</p>
                  ) : (
                    files.map((file, index) => (
                      <div key={`${file.filename}-${index}`} className="rounded-md border border-border bg-surface p-3 text-xs text-foreground">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono">{file.filename}</span>
                          <span className="text-muted-foreground">{file.status}</span>
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                          +{file.additions} / -{file.deletions}
                        </div>
                        {file.patch && (
                          <pre className="mt-2 max-h-28 overflow-auto rounded bg-background p-2 font-mono text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                            {file.patch}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {streamError && !loading && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
                {streamError}
              </div>
            )}
          </div>

          {/* RIGHT PANEL — Output */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Output</h2>
            </div>

            {loading && <OutputSkeleton />}

            {result && !loading && <SummaryOutput summary={result} />}

            {!result && !loading && (
              <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border py-24 text-center">
                <Terminal className="mb-4 h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Paste a diff or enter a PR URL, then click Summarize
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
