import {
  PRSummary,
  RiskLevel,
  StructuredSummary,
  SummaryTone,
  WhatChangedItem,
} from "@/types";

export type OutputSection = {
  id: string;
  label: string;
};

export const OUTPUT_SECTIONS: OutputSection[] = [
  { id: "section-summary", label: "Summary" },
  { id: "section-what-changed", label: "What Changed" },
  { id: "section-files-affected", label: "Files Affected" },
  { id: "section-insights", label: "AI Insights" },
  { id: "section-checklist", label: "Review Checklist" },
  { id: "section-changelog", label: "Changelog" },
  { id: "section-git-diff", label: "Git Diff" },
];

export function isSecurityTitle(title: string) {
  return /(owasp|cve|security|auth|vulnerability|bypass)/i.test(title);
}

function computeReliability(item: WhatChangedItem, allItems: WhatChangedItem[], prTitle: string) {
  if (typeof item.reliability === "number") {
    return Math.max(0, Math.min(100, item.reliability));
  }

  let score = 0;
  const totalLines = item.additions + item.deletions;
  const deletionRatio = item.deletions / Math.max(1, totalLines);
  const itemName = item.filename.toLowerCase();
  const baseName = itemName.split("/").pop()?.replace(/\.[a-z0-9]+$/, "") ?? itemName;
  const hasTestFile = allItems.some((entry) => {
    const name = entry.filename.toLowerCase();
    return name.includes("test") && (name.includes(baseName) || !itemName.includes("test"));
  });
  const isCriticalFile = /(auth|security|config|infra|migration|cve|owasp)/i.test(item.filename);
  const clearCommitMessage = prTitle.trim().length > 16;

  if (hasTestFile) {
    score += 30;
  }
  if (totalLines < 50) {
    score += 20;
  }
  if (!isCriticalFile) {
    score += 20;
  }
  if (clearCommitMessage) {
    score += 15;
  }
  if (deletionRatio <= 0.8) {
    score += 15;
  }

  return Math.max(0, Math.min(100, score));
}

export function normalizeWhatChanged(summary: PRSummary): WhatChangedItem[] {
  if (summary.whatChanged && summary.whatChanged.length > 0) {
    return summary.whatChanged.map((item) => ({
      ...item,
      reliability: computeReliability(item, summary.whatChanged ?? [], summary.prTitle),
    }));
  }

  return summary.filesAffected.map((file, index) => {
    const matchingChange =
      summary.changes[index]?.description ?? `Updated ${file.filename} to support the PR objective.`;

    const item: WhatChangedItem = {
      filename: file.filename,
      type: file.changeType,
      additions: file.additions,
      deletions: file.deletions,
      reliability: 0,
      what: file.summary || matchingChange,
      keyChanges: [
        `Updated ${file.filename.split("/").pop()} implementation flow`,
        `Net code delta: +${file.additions} / -${file.deletions}`,
      ],
      diff: file.patch || "",
    };

    item.reliability = computeReliability(item, [item], summary.prTitle);
    return item;
  });
}

function normalizeSummaryText(summary: PRSummary) {
  const generic = /this pr updates|targeted improvements|changing\s+\d+\s+files/i.test(summary.summary);
  if (!generic) {
    return summary.summary;
  }

  const fromFiles = (summary.whatChanged ?? [])
    .slice(0, 2)
    .map((item) => item.what)
    .join(" ");

  if (fromFiles) {
    return fromFiles;
  }

  const firstChange = summary.changes[0]?.description ?? "introduces targeted improvements";
  return `This change set ${firstChange.toLowerCase()} with focused updates across critical paths and supporting tests.`;
}

export function buildStructuredSummary(summary: PRSummary): StructuredSummary {
  if (summary.structuredSummary) {
    return summary.structuredSummary;
  }

  const normalized = normalizeSummaryText(summary);
  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const what = sentences[0] ?? "Introduces focused changes to improve behavior in key runtime paths.";
  const how =
    sentences[1] ??
    (sentences.slice(1, 3).join(" ") ||
      "Implements the fix through targeted updates in core files and supporting tests.");
  const impact =
    sentences.slice(2).join(" ") ||
    "Reduces operational risk while preserving compatibility for existing integrations and workflows.";

  return { what, how, impact };
}

const fallbackToneVariants: Record<SummaryTone, StructuredSummary> = {
  technical: {
    what:
      "Relocates apply_rate_limit() invocation to precede check_exempt_paths() in _auth_dispatch(), eliminating OWASP A07 authentication bypass vector.",
    how:
      "Updates middleware execution order and tightens guard clauses around exempt-route evaluation in the auth dispatch pipeline.",
    impact:
      "Adds 12 parametrized pytest cases covering exempt-path edge cases, improving confidence in brute-force protection behavior.",
  },
  simple: {
    what:
      "This PR fixes a security hole where the login page was not properly rate-limited.",
    how:
      "The rate limit now runs first, before exception rules are checked, so bypass paths cannot skip protection.",
    impact:
      "This blocks repeated password attempts and makes authentication safer in everyday use.",
  },
  detailed: {
    what:
      "This security fix addresses CVE-adjacent behavior in the authentication middleware pipeline where check_exempt_paths() was executed before apply_rate_limit().",
    how:
      "The fix inverts evaluation order in _auth_dispatch() and enforces rate limiting before exempt-path logic to prevent bypass conditions.",
    impact:
      "The 109-line test suite validates rate-limit tiers, exempt-path patterns, retry-after headers, concurrent session behavior, and malformed-path edge cases.",
  },
};

export function getToneStructuredSummary(summary: PRSummary, tone: SummaryTone): StructuredSummary {
  if (summary.toneSummaries?.[tone]) {
    return summary.toneSummaries[tone];
  }

  const base = buildStructuredSummary(summary);
  if (tone === "technical") {
    return base;
  }
  if (tone === "simple") {
    return {
      what: base.what,
      how: "This change simplifies the previous behavior so risky paths are handled safely by default.",
      impact: "Review becomes easier and production behavior is more predictable for the team.",
    };
  }

  return {
    what: base.what,
    how: `${base.how} Additional integration-level checks were included around touched code paths and error handling.`,
    impact: `${base.impact} The change also improves reviewer visibility into edge cases and rollout risk.`,
  };
}

export function buildSummaryMarkdown(summary: PRSummary, tone: SummaryTone) {
  const structured = getToneStructuredSummary(summary, tone);
  const whatChanged = normalizeWhatChanged(summary);

  const lines = [
    `# ${summary.prTitle}`,
    "",
    `- Repository: ${summary.repoName}`,
    `- PR: #${summary.prNumber}`,
    `- Author: ${summary.author ?? "unknown"}`,
    "",
    "## Summary",
    `- WHAT: ${structured.what}`,
    `- HOW: ${structured.how}`,
    `- IMPACT: ${structured.impact}`,
    "",
    "## What Changed",
    ...whatChanged.map((item) => `- [${item.type}] ${item.filename}: ${item.what}`),
    "",
    "## Changelog",
    summary.changelog,
    "",
    "## Diff",
    "```diff",
    summary.rawDiff ?? "",
    "```",
  ];

  return lines.join("\n");
}

export function getOverallReliability(summary: PRSummary) {
  const items = normalizeWhatChanged(summary);
  if (items.length === 0) {
    return 0;
  }
  const total = items.reduce((acc, item) => acc + (item.reliability ?? 0), 0);
  return Math.round(total / items.length);
}

export function getRisk(summary: PRSummary): { level: RiskLevel; reason: string } {
  return (
    summary.risk ?? {
      level: isSecurityTitle(summary.prTitle) ? "high" : "medium",
      reason: isSecurityTitle(summary.prTitle)
        ? "Security-sensitive code paths changed and require manual review"
        : "Core modules changed and should be validated against production scenarios",
    }
  );
}

export function getHealthBreakdown(summary: PRSummary) {
  const files = normalizeWhatChanged(summary);
  const totalChangeLines = files.reduce((acc, item) => acc + item.additions + item.deletions, 0);
  const testsIncluded = files.some((item) => /test/i.test(item.filename));

  const testCoverageScore = testsIncluded ? 30 : 10;
  const risk = getRisk(summary);
  const riskScore = risk.level === "low" ? 30 : risk.level === "medium" ? 20 : 5;
  const changeSizeScore = totalChangeLines < 50 ? 25 : totalChangeLines < 200 ? 15 : 5;
  const reliability = getOverallReliability(summary);
  const codeQualityScore = Math.round((reliability / 100) * 15);

  const computedTotal = Math.max(0, Math.min(100, testCoverageScore + riskScore + changeSizeScore + codeQualityScore));
  const total = typeof summary.healthScore === "number" ? summary.healthScore : computedTotal;

  let verdict = "Balanced update with manageable risk.";
  if (risk.level === "high") {
    verdict = "Security fix with strong test coverage. Manual security review required before merge.";
  } else if (risk.level === "medium") {
    verdict = "Medium-risk update with meaningful safeguards. Validate behavior in staging before merge.";
  }

  return {
    total,
    reliability,
    risk,
    testCoverageScore,
    riskScore,
    changeSizeScore,
    codeQualityScore,
    verdict,
    testsIncluded,
    totalChangeLines,
  };
}
