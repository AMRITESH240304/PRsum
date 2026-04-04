export type ChangeType = "feat" | "fix" | "refactor" | "chore";

export interface FileChange {
  filename: string;
  changeType: ChangeType;
  additions: number;
  deletions: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface PRSummary {
  id: string;
  repoName: string;
  prNumber: number;
  prTitle: string;
  date: string;
  summary: string;
  changes: { type: ChangeType; description: string }[];
  filesAffected: FileChange[];
  changelog: string;
  checklist: ChecklistItem[];
}

export interface AppSettings {
  anthropicKey: string;
  githubToken: string;
  includeChangelog: boolean;
  includeChecklist: boolean;
  theme: "dark" | "light";
}
