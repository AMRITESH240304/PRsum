import { useState, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileDropZone } from "@/components/FileDropZone";
import { SummaryOutput } from "@/components/SummaryOutput";
import { OutputSkeleton } from "@/components/OutputSkeleton";
import { mockSummary, mockDiff } from "@/lib/mock-data";
import { PRSummary } from "@/types";
import { Sparkles, Github, FileText, Upload, Terminal } from "lucide-react";

export default function Summarize() {
  const [diffInput, setDiffInput] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PRSummary | null>(null);

  const handleSummarize = useCallback(() => {
    setLoading(true);
    setResult(null);
    // Simulate AI processing
    setTimeout(() => {
      setResult(mockSummary);
      setLoading(false);
    }, 2000);
  }, []);

  const handleFileUpload = useCallback((content: string, _name: string) => {
    setDiffInput(content);
  }, []);

  const hasInput = diffInput.trim().length > 0 || githubUrl.trim().length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* LEFT PANEL — Input */}
          <div className="flex flex-col gap-4">
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
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDiffInput(mockDiff);
                      }}
                    >
                      Fetch PR
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requires a GitHub token configured in Settings for private repos.
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
              disabled={!hasInput || loading}
            >
              <Sparkles className="h-4 w-4" />
              {loading ? "Analyzing..." : "Summarize"}
            </Button>
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
