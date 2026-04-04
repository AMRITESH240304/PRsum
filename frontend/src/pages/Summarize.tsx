import { useMemo, useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileDropZone } from "@/components/FileDropZone";
import { SummaryOutput } from "@/components/SummaryOutput";
import { mockDiff } from "@/lib/mock-data";
import { PRSummary } from "@/types";
import { streamSummary } from "@/lib/api";
import { useAppStore } from "@/hooks/use-store";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Github, FileText, Upload, Terminal, GitCommitHorizontal, ShieldAlert, ChevronDown, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type StreamedFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string | null;
};

const LOADING_STEPS = [
  "Reading diff...",
  "Identifying change types...",
  "Analyzing risk...",
  "Generating summary...",
  "Building review checklist...",
];

const mockSummary: PRSummary = {
  id: "mock-575",
  repoName: "pocketpaw/pocketpaw",
  prNumber: 575,
  prTitle: "Add voice and STT support with telegram adapter",
  author: "pocketpaw",
  date: new Date().toISOString(),
  summary:
    "This PR adds voice and speech-to-text (STT) capabilities to pocketpaw, integrating a new Telegram adapter for audio message handling. Config changes extend environment variable support for the new tools.",
  changes: [
    { type: "feat", description: "Add voice and STT support to the runtime loop" },
    { type: "feat", description: "Integrate telegram adapter for audio handling" },
    { type: "feat", description: "Extend config with new environment variables" },
  ],
  filesAffected: [
    { filename: "src/pocketpaw/agents/loop.py", changeType: "feat", additions: 53, deletions: 0, status: "modified" },
    { filename: "src/pocketpaw/bus/adapters/telegram_adapter.py", changeType: "feat", additions: 57, deletions: 1, status: "modified" },
    { filename: "src/pocketpaw/config.py", changeType: "feat", additions: 15, deletions: 3, status: "modified" },
    { filename: "src/pocketpaw/tools/builtin/stt.py", changeType: "feat", additions: 49, deletions: 3, status: "added" },
    { filename: "src/pocketpaw/tools/builtin/voice.py", changeType: "feat", additions: 31, deletions: 10, status: "added" },
  ],
  changelog:
    "## pocketpaw/pocketpaw #575\n### Added\n- Voice and STT tool support\n- Telegram adapter for audio messages\n### Changed\n- Extended config.py with new env vars",
  checklist: [
    { id: "1", label: "Verify new env vars are documented in README", checked: false },
    { id: "2", label: "Test STT integration end to end", checked: false },
    { id: "3", label: "Confirm telegram adapter handles missing audio gracefully", checked: false },
    { id: "4", label: "Check voice.py error handling for unsupported formats", checked: false },
    { id: "5", label: "Validate config.py changes do not break existing deployments", checked: false },
  ],
  rawDiff:
    "diff --git a/src/pocketpaw/agents/loop.py b/src/pocketpaw/agents/loop.py\nindex 287c245f1..85a6e549f 100644\n--- a/src/pocketpaw/agents/loop.py\n+++ b/src/pocketpaw/agents/loop.py",
  pr: {
    title: "Add voice and STT support with telegram adapter",
    author: "pocketpaw",
    number: 575,
    repo: "pocketpaw/pocketpaw",
    branch_from: "feature/voice",
    branch_to: "main",
    status: "open",
    opened: "2 days ago",
    files_changed: 10,
    additions: 202,
    deletions: 21,
  },
  risk: {
    level: "medium",
    reason: "Core config files modified, may affect existing deployments",
  },
  insights: [
    { type: "warning", text: "config.py modified — env var changes may affect deployment" },
    { type: "warning", text: "No test files updated despite logic changes in loop.py" },
    { type: "insight", text: "telegram_adapter.py changes appear backward compatible" },
    { type: "insight", text: "STT and voice tools follow existing tool interface pattern" },
  ],
};

export default function Summarize() {
  const location = useLocation();
  const { credential, user } = useAppStore();
  const [diffInput, setDiffInput] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PRSummary | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [files, setFiles] = useState<StreamedFile[]>([]);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [loadingStepsVisible, setLoadingStepsVisible] = useState(1);
  const [options, setOptions] = useState({
    includeChangelog: true,
    includeChecklist: true,
    includeInsights: true,
    includeRawDiff: false,
    tone: "technical" as "technical" | "simple" | "detailed",
  });

  const applyOutputOptions = useCallback(
    (payload: PRSummary): PRSummary => {
      return {
        ...payload,
        changelog: options.includeChangelog ? payload.changelog : "",
        checklist: options.includeChecklist ? payload.checklist : [],
        insights: options.includeInsights ? payload.insights : [],
        rawDiff: options.includeRawDiff ? payload.rawDiff : "",
      };
    },
    [options.includeChangelog, options.includeChecklist, options.includeInsights, options.includeRawDiff]
  );

  useEffect(() => {
    const navSummary = (location.state as { summary?: PRSummary } | null)?.summary;
    if (navSummary) {
      setResult(navSummary);
      setProgress([]);
      setStreamError(null);
      setFiles([]);
    }
  }, [location.state]);

  useEffect(() => {
    if (!loading) {
      setLoadingStepsVisible(1);
      return;
    }

    const timer = window.setInterval(() => {
      setLoadingStepsVisible((current) => Math.min(current + 1, LOADING_STEPS.length));
    }, 500);

    return () => window.clearInterval(timer);
  }, [loading]);

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
          onSummary: (payload) => setResult(applyOutputOptions(payload)),
          onError: (message) => setStreamError(message),
        }
      );

      if (summary) {
        setResult(applyOutputOptions(summary));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to summarize PR";
      setStreamError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [credential, diffInput, githubUrl, user, applyOutputOptions]);

  const handleFileUpload = useCallback((content: string, _name: string) => {
    setDiffInput(content);
  }, []);

  const handleSimulateLoading = useCallback(() => {
    setLoading(true);
    setResult(null);
    setProgress([]);
    setFiles([]);
    setStreamError(null);

    window.setTimeout(() => {
      setResult(applyOutputOptions(mockSummary));
      setLoading(false);
    }, 2800);
  }, [applyOutputOptions]);

  const hasInput = useMemo(
    () => diffInput.trim().length > 0 || githubUrl.trim().length > 0,
    [diffInput, githubUrl]
  );

  const estimatedTokens = useMemo(() => {
    const source = diffInput.trim() || githubUrl.trim();
    if (!source) {
      return 0;
    }
    return Math.ceil(source.length / 4);
  }, [diffInput, githubUrl]);

  const estimatedFiles = useMemo(() => {
    if (!diffInput.trim()) {
      return githubUrl.trim() ? 10 : 0;
    }
    const matches = diffInput.match(/diff --git/g);
    return matches ? matches.length : Math.max(1, Math.ceil(diffInput.length / 1200));
  }, [diffInput, githubUrl]);

  const estimatedSeconds = Math.max(4, Math.round(estimatedTokens / 180) + Math.ceil(estimatedFiles / 2));

  const tokenColor =
    estimatedTokens > 8000
      ? "text-red-400"
      : estimatedTokens > 4000
        ? "text-yellow-300"
        : "text-cyan-300";

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
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

            <div className="rounded-lg border border-[#1e1e1e] bg-[#111111] px-3 py-2">
              <p className={cn("font-mono text-xs", tokenColor)}>
                ~{estimatedTokens.toLocaleString()} tokens | {estimatedFiles} files | Est. {estimatedSeconds} sec
              </p>
            </div>

            <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
              <div className="rounded-lg border border-[#1e1e1e] bg-[#111111] p-3">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between px-2 text-sm">
                    <span>⚙ Options</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", optionsOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      ["Include changelog", "includeChangelog"],
                      ["Include review checklist", "includeChecklist"],
                      ["Include AI insights", "includeInsights"],
                      ["Include raw diff in output", "includeRawDiff"],
                    ].map(([label, key]) => (
                      <label key={key} className="flex items-center gap-2 text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={Boolean(options[key as keyof typeof options])}
                          onChange={(e) =>
                            setOptions((current) => ({
                              ...current,
                              [key]: e.target.checked,
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <Separator className="bg-border" />
                  <div className="flex flex-wrap gap-2">
                    {(["technical", "simple", "detailed"] as const).map((tone) => (
                      <Button
                        key={tone}
                        type="button"
                        variant={options.tone === tone ? "default" : "outline"}
                        size="sm"
                        onClick={() => setOptions((current) => ({ ...current, tone }))}
                      >
                        {tone[0].toUpperCase() + tone.slice(1)}
                      </Button>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                size="lg"
                className="w-full gap-2 glow-accent font-medium"
                onClick={handleSummarize}
                disabled={!hasInput || loading || !credential}
              >
                <Sparkles className="h-4 w-4" />
                {loading ? "Analyzing..." : "Summarize"}
              </Button>
              <Button size="lg" variant="outline" onClick={handleSimulateLoading} disabled={loading}>
                Simulate Loading
              </Button>
            </div>

            {loading && (
              <div className="space-y-4 rounded-lg border border-[#1e1e1e] bg-[#111111] p-4">
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

            {loading && (
              <div className="space-y-3 rounded-lg border border-[#1e1e1e] bg-[#111111] p-4">
                {LOADING_STEPS.map((step, index) => (
                  <div
                    key={step}
                    className={cn(
                      "flex items-center gap-2 rounded-md border border-[#1e1e1e] bg-background/40 px-3 py-2 text-sm text-muted-foreground transition-opacity duration-200",
                      index < loadingStepsVisible ? "opacity-100" : "opacity-30"
                    )}
                  >
                    <LoaderCircle className={cn("h-4 w-4 text-cyan-300", index < loadingStepsVisible && "animate-spin")} />
                    {step}
                  </div>
                ))}

                {progress.length > 0 && (
                  <div className="rounded-md border border-[#1e1e1e] bg-background/40 p-3 text-xs text-muted-foreground">
                    {progress[progress.length - 1]}
                  </div>
                )}

                {[1, 2, 3].map((skeleton) => (
                  <div key={skeleton} className="h-20 animate-pulse rounded-md border border-[#1e1e1e] bg-[#0f0f0f]" />
                ))}
              </div>
            )}

            {result && !loading && <SummaryOutput summary={result} onResummarize={handleSummarize} />}

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
