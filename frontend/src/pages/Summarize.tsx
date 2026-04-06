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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Github, FileText, Upload, Terminal, GitCommitHorizontal, ShieldAlert, ChevronDown, LoaderCircle, Clipboard } from "lucide-react";
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
  prTitle: "Add semantic memory subsystem with vector retrieval",
  author: "pocketpaw",
  date: new Date().toISOString(),
  summary:
    "This PR introduces a semantic memory subsystem that allows pocketpaw to index, retrieve, and manage long-term memory through vector similarity search. It adds a FAISS-backed file store, a dedicated manager layer, dashboard API endpoints, and real-time UI updates via WebSocket events. The implementation includes broad regression and security tests to reduce rollout risk.",
  structuredSummary: {
    what: "Introduces a new semantic memory capability for storing and retrieving long-term context.",
    how: "Implements a FAISS-backed storage engine with Ollama embeddings, wires memory manager services into dashboard APIs, and adds frontend controls with real-time synchronization.",
    impact: "Improves retrieval quality and transparency for memory-driven responses while increasing confidence through focused regression and security tests.",
  },
  changes: [
    { type: "feat", description: "Introduce file-based vector memory store with FAISS search" },
    { type: "feat", description: "Add memory manager service and dashboard API integration" },
    { type: "feat", description: "Implement memory modal UI and real-time WebSocket updates" },
    { type: "chore", description: "Add comprehensive subsystem, regression, and security tests" },
  ],
  whatChanged: [
    {
      filename: "src/pocketpaw/memory/file_store.py",
      type: "feat",
      additions: 1641,
      deletions: 9,
      reliability: 82,
      what: "Adds the primary semantic memory engine, including vector indexing, embedding orchestration, retrieval filtering, and persistence flows.",
      keyChanges: [
        "Introduced FAISS index lifecycle management and persistence routines",
        "Added Ollama embedding generation and memory chunk normalization",
        "Implemented retrieval ranking with configurable thresholds",
      ],
      diff:
        "@@ -0,0 +1,28 @@\n+class FileMemoryStore:\n+    def add_entry(self, entry):\n+        vector = self.embedder.embed(entry.text)\n+        self.index.add(vector)\n+        self._persist_metadata(entry)\n+\n+    def search(self, query, top_k=5):\n+        query_vector = self.embedder.embed(query)\n+        distances, indices = self.index.search(query_vector, top_k)\n+        return self._hydrate_results(indices, distances)",
    },
    {
      filename: "src/pocketpaw/memory/manager.py",
      type: "feat",
      additions: 92,
      deletions: 4,
      reliability: 88,
      what: "Adds a manager layer that coordinates memory CRUD operations and encapsulates business rules before persisting into the vector store.",
      keyChanges: [
        "Introduced service-level validation for memory payloads",
        "Centralized expiration and retrieval orchestration",
      ],
      diff:
        "@@ -12,7 +12,17 @@ class MemoryManager:\n+    def save_memory(self, payload):\n+        self._validate(payload)\n+        return self.store.add_entry(payload)\n+\n+    def query_memory(self, prompt):\n+        return self.store.search(prompt, top_k=self.config.top_k)",
    },
    {
      filename: "src/pocketpaw/dashboard.py",
      type: "feat",
      additions: 55,
      deletions: 5,
      reliability: 77,
      what: "Adds memory API routes for listing, updating, and deleting memory entries and wires the manager to existing dashboard endpoints.",
      keyChanges: [
        "Added dashboard endpoints for memory lifecycle operations",
        "Connected endpoint handlers with memory manager service",
      ],
      diff:
        "@@ -188,6 +188,15 @@\n+@router.get('/memory')\n+def list_memory():\n+    return memory_manager.list_entries()\n+\n+@router.patch('/memory/{id}')\n+def update_memory(id, payload):\n+    return memory_manager.update_entry(id, payload)",
    },
    {
      filename: "src/pocketpaw/frontend/templates/components/modals/memory.html",
      type: "feat",
      additions: 147,
      deletions: 9,
      reliability: 80,
      what: "Introduces the memory management modal UI for search, edit, and delete workflows with improved transparency for stored memory.",
      keyChanges: [
        "Added modal shell with search and edit controls",
        "Linked user actions to new memory API endpoints",
      ],
      diff:
        "@@ -0,0 +1,18 @@\n+<section id=\"memory-modal\">\n+  <header>Memory</header>\n+  <input id=\"memory-search\" />\n+  <div id=\"memory-results\"></div>\n+</section>",
    },
    {
      filename: "tests/test_file_memory_fixes.py",
      type: "chore",
      additions: 623,
      deletions: 1,
      reliability: 92,
      what: "Adds extensive regression coverage for edge cases including concurrent writes, malformed payloads, and recovery scenarios.",
      keyChanges: [
        "Introduced integration-like test matrix for large memory payloads",
        "Added corruption recovery and partial write rollback assertions",
      ],
      diff:
        "@@ -0,0 +1,16 @@\n+def test_recovers_after_partial_write(tmp_path):\n+    store = FileMemoryStore(tmp_path)\n+    store.add_entry(sample_entry())\n+    corrupt_index_file(tmp_path)\n+    assert store.search('hello') == []",
    },
  ],
  filesAffected: [
    { filename: "src/pocketpaw/memory/file_store.py", changeType: "feat", additions: 1641, deletions: 9, status: "added", summary: "Introduces a new file-based vector store for long-term memory. Implements embedding generation via Ollama, FAISS-based similarity search, and persistent storage of memory chunks. This is the core storage engine for the new memory subsystem." },
    { filename: "src/pocketpaw/memory/manager.py", changeType: "feat", additions: 92, deletions: 4, status: "added", summary: "Adds a MemoryManager class that coordinates the full memory lifecycle — storing, retrieving, and expiring entries. Acts as the service layer between API endpoints and the file store." },
    { filename: "src/pocketpaw/dashboard.py", changeType: "feat", additions: 55, deletions: 5, status: "modified", summary: "Adds three new REST endpoints for memory management: PATCH for updating entries, and supporting GET/DELETE routes. Wires the memory manager into the existing dashboard FastAPI app." },
    { filename: "src/pocketpaw/dashboard_ws.py", changeType: "feat", additions: 15, deletions: 0, status: "modified", summary: "Extends the WebSocket handler to broadcast memory update events to connected clients in real time, enabling the dashboard UI to react without polling." },
    { filename: "src/pocketpaw/config.py", changeType: "feat", additions: 26, deletions: 2, status: "modified", summary: "Adds embedding_base_url configuration field pointing to the Ollama embedding provider, and compaction_recent_window for controlling session history compaction behavior." },
    { filename: "src/pocketpaw/frontend/templates/components/modals/memory.html", changeType: "feat", additions: 147, deletions: 9, status: "added", summary: "Introduces a new memory management modal in the dashboard UI. Allows users to view, search, edit, and delete long-term memory entries directly from the interface." },
    { filename: "src/pocketpaw/frontend/js/features/transparency.js", changeType: "feat", additions: 243, deletions: 1, status: "modified", summary: "Large addition implementing the transparency feature — likely showing users what memory entries exist and how they influence responses. Main frontend logic for the memory modal." },
    { filename: "tests/test_memory.py", changeType: "chore", additions: 286, deletions: 0, status: "added", summary: "Comprehensive test suite for the new memory subsystem covering CRUD operations, similarity search, and edge cases like empty stores and malformed inputs." },
    { filename: "tests/test_file_memory_fixes.py", changeType: "chore", additions: 623, deletions: 1, status: "added", summary: "Extensive regression and integration tests specifically targeting file-based memory edge cases — large payloads, concurrent writes, and recovery after corruption." },
    { filename: "tests/test_dashboard_security.py", changeType: "chore", additions: 49, deletions: 0, status: "added", summary: "Adds security-focused tests for the new dashboard endpoints, verifying authentication requirements and input sanitization on memory API routes." },
  ],
  changelog:
    "## feat(memory): semantic memory subsystem\n\n### Added\n- FAISS-backed file memory store with embedding pipeline\n- Memory manager service for lifecycle orchestration\n- Dashboard memory endpoints and modal UI\n\n### Changed\n- Dashboard WebSocket stream now emits memory update events\n- Runtime config supports embedding provider and compaction window\n\n### Testing\n- Added regression and security suites for memory endpoints and store recovery",
  checklist: [
    { id: "1", label: "Validate memory APIs enforce auth for read/update/delete", checked: false, priority: "critical" },
    { id: "2", label: "Run regression suite for vector retrieval and persistence", checked: false, priority: "high" },
    { id: "3", label: "Confirm embedding provider fallback behavior on timeout", checked: false, priority: "high" },
    { id: "4", label: "Verify dashboard modal handles empty and corrupted state", checked: false, priority: "medium" },
    { id: "5", label: "Ensure config docs include new memory-related env vars", checked: false, priority: "medium" },
  ],
  rawDiff:
    "diff --git a/src/pocketpaw/memory/file_store.py b/src/pocketpaw/memory/file_store.py\nindex 6fbc4d4..a3d1062 100644\n--- a/src/pocketpaw/memory/file_store.py\n+++ b/src/pocketpaw/memory/file_store.py\n@@ -0,0 +1,18 @@\n+class FileMemoryStore:\n+    def add_entry(self, entry):\n+        vector = self.embedder.embed(entry.text)\n+        self.index.add(vector)\n+        self._persist_metadata(entry)\n+\n+diff --git a/src/pocketpaw/dashboard.py b/src/pocketpaw/dashboard.py\n@@ -188,6 +188,15 @@\n+@router.get('/memory')\n+def list_memory():\n+    return memory_manager.list_entries()",
  pr: {
    title: "Add semantic memory subsystem with vector retrieval",
    author: "pocketpaw",
    number: 575,
    repo: "pocketpaw/pocketpaw",
    branch_from: "feature/memory",
    branch_to: "main",
    status: "open",
    opened: "2 days ago",
    files_changed: 10,
    additions: 3177,
    deletions: 31,
    description:
      "Adds a semantic memory engine with vector retrieval and dashboard controls. Includes manager orchestration, API endpoints, and comprehensive tests for regressions and security.",
  },
  risk: {
    level: "medium",
    reason: "High-volume core memory storage changes plus config updates require staged rollout and close monitoring",
  },
  insights: [
    { type: "insight", text: "Memory subsystem isolates retrieval concerns into a dedicated manager and storage engine." },
    { type: "warning", text: "Large net-new code in file_store.py increases review surface; prioritize retrieval edge cases." },
    { type: "positive", text: "Regression coverage is extensive, including corruption and concurrency scenarios." },
    { type: "security", text: "Dashboard memory routes should keep strict auth checks before merge." },
  ],
  prUrl: "https://github.com/pocketpaw/pocketpaw/pull/575",
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
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
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
      setAgentEvents([]);
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

  const fileBreakdownItems = useMemo<FileBreakdownItem[]>(() => {
    const source = result?.filesAffected ?? [];
    return source.map((file) => ({
      path: file.filename,
      type: file.changeType,
      additions: file.additions,
      deletions: file.deletions,
      summary:
        file.summary ||
        `This file was updated in this pull request to support the broader change set around ${result?.prTitle ?? "the requested feature"}. Review its patch carefully for behavior impact and integration compatibility.`,
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

  const handleSaveToHistory = useCallback(() => {
    toast.success("Summary is saved automatically after generation");
  }, []);

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
                <TabsTrigger
                  value="file-breakdown"
                  className="flex-1 gap-1.5 data-[state=active]:bg-card"
                  disabled={!result}
                >
                  📄 File Breakdown
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

              <TabsContent value="file-breakdown">
                <div className="rounded-lg border border-[#1e1e1e] bg-[#111111] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Per-file markdown summaries</h3>
                    <Button variant="outline" size="sm" className="gap-2" onClick={copyAllFileSummaries}>
                      <Clipboard className="h-3.5 w-3.5" /> Copy All Summaries
                    </Button>
                  </div>
                  <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {fileBreakdownItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Generate a summary first to view file-level breakdowns.</p>
                    ) : (
                      fileBreakdownItems.map((item, idx) => (
                        <div key={`${item.path}-${idx}`} className="rounded-md border border-[#1e1e1e] bg-[#0f0f0f] p-3">
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

                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Agent step timeline
                  </p>
                  {agentEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Waiting for agent events...</p>
                  ) : (
                    <div className="max-h-56 space-y-2 overflow-auto pr-1">
                      {agentEvents.map((event, index) => (
                        <div
                          key={`${event.step}-${event.agent}-${index}`}
                          className="rounded-md border border-[#1e1e1e] bg-[#0f0f0f] px-3 py-2 text-xs"
                        >
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
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground">{event.agent}</p>
                        </div>
                      ))}
                    </div>
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

            {result && !loading && (
              <SummaryOutput
                summary={result}
                onResummarize={handleSummarize}
                onSaveToHistory={handleSaveToHistory}
              />
            )}

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
