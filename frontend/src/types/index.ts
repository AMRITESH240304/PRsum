export type ChangeType = "feat" | "fix" | "refactor" | "chore";
export type RiskLevel = "low" | "medium" | "high";

export interface FileChange {
  filename: string;
  changeType: ChangeType;
  additions: number;
  deletions: number;
  status?: string;
  patch?: string | null;
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
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
}

export interface SummaryInsight {
  type: "warning" | "insight";
  text: string;
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
  risk?: {
    level: RiskLevel;
    reason: string;
  };
  insights?: SummaryInsight[];
}

export interface AppSettings {
  anthropicKey: string;
  githubToken: string;
  includeChangelog: boolean;
  includeChecklist: boolean;
  includeInsights?: boolean;
  includeRawDiff?: boolean;
  tone?: "technical" | "simple" | "detailed";
  theme: "dark" | "light";
}

export interface AuthUser {
  id: string;
  google_sub: string;
  email: string;
  name: string;
  picture?: string | null;
}
