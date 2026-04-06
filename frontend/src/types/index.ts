export type ChangeType = "feat" | "fix" | "refactor" | "chore";
export type RiskLevel = "low" | "medium" | "high";
export type ChecklistPriority = "critical" | "high" | "medium";
export type SummaryTone = "technical" | "simple" | "detailed";

export interface FileChange {
  filename: string;
  changeType: ChangeType;
  additions: number;
  deletions: number;
  status?: string;
  patch?: string | null;
  summary?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  priority?: ChecklistPriority;
}

export interface PRMetadata {
  title: string;
  author: string;
  number: number;
  repo: string;
  branch_from: string;
  branch_to: string;
  status: "open" | "merged" | "closed";
  opened: string;
  files_changed: number;
  additions: number;
  deletions: number;
  description?: string;
}

export interface SummaryInsight {
  type: "security" | "warning" | "insight" | "positive";
  text: string;
}

export interface StructuredSummary {
  what: string;
  how: string;
  impact: string;
}

export interface WhatChangedItem {
  filename: string;
  type: ChangeType;
  additions: number;
  deletions: number;
  reliability?: number;
  what: string;
  keyChanges: string[];
  diff?: string;
}

export interface PRSummary {
  id: string;
  repoName: string;
  prNumber: number;
  prTitle: string;
  author?: string | null;
  date: string;
  summary: string;
  changes: { type: ChangeType; description: string }[];
  filesAffected: FileChange[];
  changelog: string;
  checklist: ChecklistItem[];
  rawDiff?: string;
  pr?: PRMetadata;
  structuredSummary?: StructuredSummary;
  toneSummaries?: Record<SummaryTone, StructuredSummary>;
  whatChanged?: WhatChangedItem[];
  risk?: {
    level: RiskLevel;
    reason: string;
  };
  insights?: SummaryInsight[];
  prUrl?: string;
  healthScore?: number;
}

export interface AppSettings {
  anthropicKey: string;
  githubToken: string;
  includeChangelog: boolean;
  includeChecklist: boolean;
  includeInsights?: boolean;
  includeRawDiff?: boolean;
  tone?: SummaryTone;
  theme: "dark" | "light";
}

export interface AuthUser {
  id: string;
  google_sub: string;
  email: string;
  name: string;
  picture?: string | null;
}
