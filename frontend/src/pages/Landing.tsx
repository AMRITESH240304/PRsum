import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, FileText, Github, Upload, Zap, Brain, FileOutput } from "lucide-react";
import { Navbar } from "@/components/Navbar";

const features = [
  {
    icon: FileText,
    title: "Paste Diff",
    description: "Paste any git diff directly and get an instant structured summary.",
  },
  {
    icon: Github,
    title: "GitHub URL",
    description: "Drop a PR link and we'll fetch the diff and summarize it for you.",
  },
  {
    icon: Upload,
    title: "Upload File",
    description: "Upload .diff or .patch files — drag and drop supported.",
  },
];

const steps = [
  { icon: FileText, label: "Input", description: "Paste, link, or upload your diff" },
  { icon: Brain, label: "AI Reads", description: "AI analyzes every change in the PR" },
  { icon: FileOutput, label: "Summary", description: "Get a structured, actionable summary" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="container flex flex-col items-center py-24 text-center md:py-32">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 font-mono text-xs text-muted-foreground">
          <Zap className="h-3 w-3 text-primary" />
          AI-powered PR analysis
        </div>
        <h1 className="mb-6 max-w-3xl text-4xl font-bold tracking-tight text-foreground md:text-6xl">
          Understand any PR{" "}
          <span className="gradient-text">in seconds</span>
        </h1>
        <p className="mb-8 max-w-xl text-lg text-muted-foreground">
          Paste a diff, drop a GitHub URL, or upload a patch file — get a plain-English summary,
          changelog, and review checklist instantly.
        </p>
        <Link to="/summarize">
          <Button size="lg" className="gap-2 glow-accent font-medium">
            Try it free
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>

      {/* Features */}
      <section className="container pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="border-border bg-card transition-colors hover:border-primary/30">
              <CardContent className="flex flex-col items-start gap-3 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container pb-24">
        <h2 className="mb-12 text-center text-2xl font-bold text-foreground">How it works</h2>
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-center">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-surface">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="hidden h-5 w-5 text-muted-foreground md:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-mono">PRSum</span>
          <span>Built for developers</span>
        </div>
      </footer>
    </div>
  );
}
