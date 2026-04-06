import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDropZone } from "@/components/FileDropZone";
import { SummaryOutput } from "@/components/SummaryOutput";
import { QuickNav } from "@/components/QuickNav";
import { PRAtAGlance } from "@/components/PRAtAGlance";
import { SimilarPRs } from "@/components/SimilarPRs";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { LoadingState } from "@/components/LoadingState";

import { mockDiff } from "@/lib/mock-data";
import { buildSummaryMarkdown, OUTPUT_SECTIONS } from "@/lib/summary-utils";
import { streamSummary, saveHistorySummary } from "@/lib/api";
import { PRSummary, SummaryTone } from "@/types";
import { useAppStore } from "@/hooks/use-store";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  Clipboard,
  Download,
  Github,
  FileText,
  Upload,
  Terminal,
  ShieldAlert,
  ChevronDown,
  Sparkles,
  Save,
  Link as LinkIcon,
  RefreshCcw,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type StreamedFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string | null;
};

type AgentEvent = {
  step: string;
  agent: string;
  status: string;
  message: string;
  details?: Record<string, unknown>;
};

type FileBreakdownItem = {
  path: string;
  type: "feat" | "fix" | "refactor" | "chore";
  additions: number;
  deletions: number;
  summary: string;
};

const LOADING_STEPS = [
  "Parsing diff structure...",
  "Analyzing security implications...",
  "Generating file summaries...",
  "Building review checklist...",
  "Finalizing output...",
];

const mockSummary: PRSummary = {
  id: "mock-575",
  repoName: "pocketpaw/pocketpaw",
  prNumber: 575,
  prTitle: "fix(auth): enforce rate limit before exempt-path checks",
  author: "pocketpaw",
  date: new Date().toISOString(),
  summary:
    "This PR fixes a security gap in the authentication middleware by ensuring rate limiting runs before exempt-path checks. The patch also expands test coverage around bypass behavior and malformed path handling.",
  structuredSummary: {
    what: "Fixes an authentication bypass where exempt routes could skip rate limiting.",
    how: "Moves rate-limit enforcement earlier in middleware dispatch and updates related guard checks.",
    impact: "Prevents brute-force attempts on exempt path patterns and hardens login protection.",
  },
  toneSummaries: {
    technical: {
      what:
        "Relocates apply_rate_limit() invocation to precede check_exempt_paths() in _auth_dispatch(), eliminating OWASP A07 authentication bypass vector.",
      how:
        "Refactors middleware order to guarantee throttle execution before exempt-path branching and normalizes retry-after header paths.",
      impact:
        "Adds 12 parametrized pytest cases covering exempt-path edge cases and malformed route behavior to reduce regression risk.",
    },
    simple: {
      what:
        "This PR fixes a security hole where the login page was not properly rate-limited.",
      how:
        "Now the rate limit runs first, before any exception checks can bypass it.",
      impact:
        "Attackers can no longer make unlimited password attempts on exempt-looking routes.",
    },
    detailed: {
      what:
        "This security fix addresses CVE-adjacent behavior in the authentication middleware pipeline where exempt-path checks ran before throttling.",
      how:
        "The patch inverts order in _auth_dispatch(): apply_rate_limit() now executes first, then check_exempt_paths() and downstream auth guards.",
      impact:
        "The expanded test suite validates rate-limit tiers, exempt-path patterns, retry-after headers, concurrent sessions, and malformed path edge cases.",
    },
  },
  changes: [
    { type: "fix", description: "Reorder auth middleware to enforce rate limits before exempt checks" },
    { type: "chore", description: "Add new parametrized tests for exempt-path and malformed-route cases" },
  ],
  whatChanged: [
    {
      filename: "backend/middleware/auth_dispatch.py",
      type: "fix",
      additions: 92,
      deletions: 13,
      reliability: 68,
      what: "Moves rate-limit enforcement before exempt-path resolution in auth dispatch logic.",
      keyChanges: [
        "Calls apply_rate_limit() before check_exempt_paths()",
        "Normalizes retry-after headers for blocked paths",
        "Adds extra guard checks around malformed route values",
      ],
      diff:
        "@@ -42,7 +42,15 @@\n-    if check_exempt_paths(path):\n-        return allow_request()\n+    apply_rate_limit(request)\n+    if check_exempt_paths(path):\n+        return allow_request()\n+\n+    enforce_authentication(request)",
    },
    {
      filename: "tests/test_auth_dispatch.py",
      type: "chore",
      additions: 43,
      deletions: 1,
      reliability: 74,
      what: "Expands auth middleware tests for exempt-path edge cases and malformed route behavior.",
      keyChanges: [
        "Adds 12 parametrized test cases",
        "Covers retry-after and block-window expectations",
      ],
      diff:
        "@@ -0,0 +1,18 @@\n+@pytest.mark.parametrize('path,expected_status', [\n+    ('/login', 429),\n+    ('/auth/exempt', 200),\n+])\n+def test_rate_limit_applied_before_exempt(path, expected_status):\n+    ...",
    },
  ],
  filesAffected: [
    {
      filename: "backend/middleware/auth_dispatch.py",
      changeType: "fix",
      additions: 92,
      deletions: 13,
      status: "modified",
      summary: "Refactors auth dispatch order so throttling always runs before exempt path checks.",
    },
    {
      filename: "tests/test_auth_dispatch.py",
      changeType: "chore",
      additions: 43,
      deletions: 1,
      status: "added",
      summary: "Adds regression and edge-case coverage for authentication middleware ordering.",
    },
  ],
  changelog:
    "## fix(auth): rate-limit ordering\n\n### Fixed\n- Enforced apply_rate_limit() before exempt-path checks in auth dispatch\n\n### Added\n- Parametrized auth middleware tests for exempt and malformed route paths",
  checklist: [
    { id: "1", label: "Verify no exempt route can bypass throttling", checked: false, priority: "critical" },
    { id: "2", label: "Validate retry-after headers for blocked attempts", checked: false, priority: "high" },
    { id: "3", label: "Run auth middleware regression suite", checked: false, priority: "high" },
    { id: "4", label: "Confirm docs mention changed middleware order", checked: false, priority: "medium" },
  ],
  rawDiff:
    "diff --git a/backend/middleware/auth_dispatch.py b/backend/middleware/auth_dispatch.py\n@@ -42,7 +42,15 @@\n-    if check_exempt_paths(path):\n+    apply_rate_limit(request)",
  pr: {
    title: "fix(auth): enforce rate limit before exempt-path checks",
    author: "pocketpaw",
    number: 575,
    repo: "pocketpaw/pocketpaw",
    branch_from: "fix/auth-rate-limit-order",
    branch_to: "main",
    status: "open",
    opened: "2 days ago",
    files_changed: 2,
    additions: 135,
    deletions: 2,
    description:
      "Fixes auth middleware ordering so exempt path checks cannot bypass throttling. Includes expanded test coverage.",
  },
  risk: {
    level: "high",
    reason: "Authentication middleware behavior changed and requires security validation before merge",
  },
  insights: [
    { type: "security", text: "Authentication and rate-limiting paths were modified; security review required." },
    { type: "positive", text: "Test suite now covers exempt path and malformed route edge cases." },
    { type: "warning", text: "Middleware ordering changes may impact legacy clients relying on previous behavior." },
  ],
  prUrl: "https://github.com/pocketpaw/pocketpaw/pull/575",
  healthScore: 72,
};

export default function Summarize() {
  const location = useLocation();
  const { credential, user } = useAppStore();

  const githubInputRef = useRef<HTMLInputElement | null>(null);
  const rightPanelRef = useRef<HTMLDivElement | null>(null);

  const [diffInput, setDiffInput] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PRSummary | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [files, setFiles] = useState<StreamedFile[]>([]);
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(OUTPUT_SECTIONS[0].id);

  const [options, setOptions] = useState({
    includeChangelog: true,
    includeChecklist: true,
    includeInsights: true,
    includeRawDiff: false,
    tone: "technical" as SummaryTone,
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
      setAgentEvents([]);
    }
  }, [location.state]);

  useEffect(() => {
    if (!result || loading || !rightPanelRef.current) {
      return;
    }

    const root = rightPanelRef.current;
    const nodes = OUTPUT_SECTIONS.map((section) =>
      root.querySelector<HTMLElement>(`#${section.id}`)
    ).filter((node): node is HTMLElement => Boolean(node));

    if (nodes.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        root,
        threshold: [0.2, 0.45, 0.7],
        rootMargin: "-64px 0px -40% 0px",
      }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [result, loading]);

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
    setAgentEvents([]);
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
          onAgent: (event) => setAgentEvents((current) => [...current, event]),
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
    setAgentEvents([]);
    setStreamError(null);

    const stageMessages = [
      "Parsing diff structure...",
      "Analyzing security implications...",
      "Generating file summaries...",
      "Building review checklist...",
      "Finalizing output...",
    ];

    stageMessages.forEach((message, index) => {
      window.setTimeout(() => {
        setProgress((current) => [...current, message]);
      }, index * 420);
    });

    window.setTimeout(() => {
      setResult(applyOutputOptions(mockSummary));
      setLoading(false);
    }, 2300);
  }, [applyOutputOptions]);

  const jumpToSection = useCallback((id: string) => {
    const root = rightPanelRef.current;
    if (!root) {
      return;
    }

    const target = root.querySelector<HTMLElement>(`#${id}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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

  const fileBreakdownItems = useMemo<FileBreakdownItem[]>(() => {
    const source = result?.filesAffected ?? [];
    return source.map((file) => ({
      path: file.filename,
      type: file.changeType,
      additions: file.additions,
      deletions: file.deletions,
      summary:
        file.summary ||
        `This file was updated in this pull request to support ${result?.prTitle ?? "the requested feature"}. Review this patch for behavior impact and integration compatibility.`,
    }));
  }, [result]);

  const copyAllFileSummaries = useCallback(async () => {
    if (fileBreakdownItems.length === 0) {
      toast.error("No file summaries available yet");
      return;
    }

    const text = fileBreakdownItems
      .map((item) => {
        return `### [${item.type}] ${item.path} (+${item.additions} -${item.deletions})\n${item.summary}`;
      })
      .join("\n\n");

    await navigator.clipboard.writeText(text);
    toast.success("Copied all file summaries");
  }, [fileBreakdownItems]);

  const copyFullSummary = useCallback(async () => {
    if (!result) {
      return;
    }
    const markdown = buildSummaryMarkdown(result, options.tone);
    await navigator.clipboard.writeText(markdown);
    toast.success("Copied full summary");
  }, [result, options.tone]);

  const exportMarkdown = useCallback(() => {
    if (!result) {
      return;
    }
    const markdown = buildSummaryMarkdown(result, options.tone);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.repoName.replace("/", "-")}-pr-${result.prNumber}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success("Markdown exported");
  }, [result, options.tone]);

  const handleSaveToHistory = useCallback(async () => {
    if (!result) {
      return;
    }

    try {
      await saveHistorySummary(credential ?? undefined, result);
      toast.success("Saved to history");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save history");
    }
  }, [credential, result]);

  const openGitHubPR = useCallback(() => {
    const target = result?.prUrl || githubUrl;
    if (!target) {
      toast.error("No GitHub URL available");
      return;
    }
    window.open(target, "_blank", "noopener,noreferrer");
  }, [result?.prUrl, githubUrl]);

  const tokenColor =
    estimatedTokens > 8000
      ? "text-red-400"
      : estimatedTokens > 4000
        ? "text-yellow-300"
        : "text-cyan-300";

  const activeSectionLabel =
    OUTPUT_SECTIONS.find((section) => section.id === activeSection)?.label ?? "Summary";

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navbar />

      <div className="summarize-page">
        <aside className="left-panel panel-scroll space-y-5">
          {!user && (
            <div className="flex items-start gap-3 rounded-[10px] border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground">
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
              <TabsTrigger
                value="file-breakdown"
                className="flex-1 gap-1.5 data-[state=active]:bg-card"
                disabled={!result}
              >
                Files
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paste">
              <Textarea
                value={diffInput}
                onChange={(event) => setDiffInput(event.target.value)}
                placeholder={mockDiff}
                className="min-h-[320px] resize-none rounded-[10px] border-border bg-surface font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/40"
              />
            </TabsContent>

            <TabsContent value="github">
              <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface p-5">
                <label className="text-sm font-medium text-foreground">Pull Request URL</label>
                <Input
                  ref={githubInputRef}
                  value={githubUrl}
                  onChange={(event) => setGithubUrl(event.target.value)}
                  placeholder="https://github.com/user/repo/pull/42"
                  className="border-border bg-card font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  The backend fetches diff, review comments, and metadata from GitHub.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="upload">
              <FileDropZone onFile={handleFileUpload} />
            </TabsContent>

            <TabsContent value="file-breakdown">
              <div className="rounded-[10px] border border-[#1e1e1e] bg-[#111111] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Per-file markdown summaries</h3>
                  <Button variant="outline" size="sm" className="gap-2" onClick={copyAllFileSummaries}>
                    <Clipboard className="h-3.5 w-3.5" /> Copy All
                  </Button>
                </div>
                <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1 panel-scroll">
                  {fileBreakdownItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Generate a summary first to view file-level breakdowns.
                    </p>
                  ) : (
                    fileBreakdownItems.map((item, index) => (
                      <div key={`${item.path}-${index}`} className="rounded-md border border-[#1e1e1e] bg-[#0f0f0f] p-3">
                        <div className="flex items-start justify-between gap-2 text-xs">
                          <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-cyan-300">
                            {item.type}
                          </span>
                          <span className="font-mono text-[11px]">
                            <span className="text-green-400">+{item.additions}</span>{" "}
                            <span className="text-red-400">-{item.deletions}</span>
                          </span>
                        </div>
                        <p className="mt-2 break-all font-mono text-xs text-foreground">{item.path}</p>
                        <Separator className="my-2 bg-[#1e1e1e]" />
                        <p className="text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="rounded-[10px] border border-[#1e1e1e] bg-[#111111] px-3 py-2">
            <p className={cn("font-mono text-xs", tokenColor)}>
              ~{estimatedTokens.toLocaleString()} tokens | {estimatedFiles} files | Est. {estimatedSeconds} sec
            </p>
          </div>

          <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
            <div className="rounded-[10px] border border-[#1e1e1e] bg-[#111111] p-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-2 text-sm">
                  <span>Options</span>
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
                        onChange={(event) =>
                          setOptions((current) => ({
                            ...current,
                            [key]: event.target.checked,
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <Separator className="bg-border" />
                <div className="flex flex-wrap gap-2">
                  {(["technical", "simple", "detailed"] as SummaryTone[]).map((tone) => (
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
            <Card className="card-elevated border-[#1e1e1e] bg-[#111111]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Live Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0">
                <div className="space-y-2">
                  {progress.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Waiting for stream events...</p>
                  ) : (
                    progress.map((item, index) => (
                      <div key={`${item}-${index}`} className="card-enter rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground">
                        {item}
                      </div>
                    ))
                  )}
                </div>

                <Separator className="bg-border" />
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Agent file scan</p>
                <div className="max-h-32 space-y-2 overflow-y-auto panel-scroll pr-1">
                  {files.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Waiting for file events...</p>
                  ) : (
                    files.map((file, index) => (
                      <div key={`${file.filename}-${index}`} className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono">{file.filename}</span>
                          <span className="text-muted-foreground">{file.status}</span>
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                          +{file.additions} / -{file.deletions}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <Separator className="bg-border" />
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Agent timeline</p>
                <div className="max-h-36 space-y-2 overflow-y-auto panel-scroll pr-1">
                  {agentEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Waiting for agent events...</p>
                  ) : (
                    agentEvents.map((event, index) => (
                      <div key={`${event.step}-${event.agent}-${index}`} className="rounded-md border border-[#1e1e1e] bg-[#0f0f0f] px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-cyan-300">{event.step}</span>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                              event.status === "done"
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                : event.status === "error"
                                  ? "border-red-500/40 bg-red-500/10 text-red-300"
                                  : "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
                            )}
                          >
                            {event.status}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">{event.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {streamError && !loading && (
            <div className="rounded-[10px] border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
              {streamError}
            </div>
          )}

          {result && !loading && (
            <>
              <PRAtAGlance summary={result} />

              <div className="sticky top-0 z-10 rounded-[10px] bg-[#0a0a0a]/90 py-1 backdrop-blur">
                <QuickNav items={OUTPUT_SECTIONS} activeId={activeSection} onJump={jumpToSection} />
              </div>

              <Card className="card-elevated border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-4 pt-0">
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={copyFullSummary}>
                    <Clipboard className="h-4 w-4" /> Copy Full Summary
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={exportMarkdown}>
                    <Download className="h-4 w-4" /> Export as Markdown
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={handleSaveToHistory}>
                    <Save className="h-4 w-4" /> Save to History
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={openGitHubPR}>
                    <LinkIcon className="h-4 w-4" /> Open PR on GitHub
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={handleSummarize}>
                    <RefreshCcw className="h-4 w-4" /> Re-summarize
                  </Button>
                </CardContent>
              </Card>

              <SimilarPRs summary={result} />
            </>
          )}

          <KeyboardShortcuts
            onFocusGithub={() => githubInputRef.current?.focus()}
            onSummarize={() => {
              if (!loading) {
                handleSummarize();
              }
            }}
            onCopy={copyFullSummary}
            onExport={exportMarkdown}
            canUseSummaryActions={Boolean(result)}
          />
        </aside>

        <main ref={rightPanelRef} className="right-panel panel-scroll">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Output</h2>
          </div>

          {result && !loading && (
            <div className="sticky top-0 z-20 mb-4">
              <span className="inline-flex items-center rounded-full border border-border bg-card/95 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                Pinned: {activeSectionLabel}
              </span>
            </div>
          )}

          {loading && <LoadingState steps={LOADING_STEPS} progress={progress} />}

          {result && !loading && <SummaryOutput summary={result} tone={options.tone} />}

          {!result && !loading && (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[10px] border border-dashed border-border text-center">
              <Terminal className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Paste a diff or enter a PR URL, then click Summarize.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
