import { AuthUser, PRSummary } from "@/types";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE_URL = (configuredApiBaseUrl
  ? configuredApiBaseUrl
  : import.meta.env.PROD
    ? ""
    : "http://localhost:8000"
).replace(/\/+$/, "");

function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function buildHeaders(credential?: string | null, json = true) {
  const headers: HeadersInit = {};
  if (json) {
    headers["Content-Type"] = "application/json";
  }
  if (credential) {
    headers["Authorization"] = `Bearer ${credential}`;
  }
  return headers;
}

export async function loginWithGoogle(credential: string): Promise<{ user: AuthUser }> {
  const response = await fetch(apiUrl("/auth/google"), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ credential }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to sign in with Google");
  }

  return response.json();
}

export async function fetchHistory(credential: string): Promise<PRSummary[]> {
  const response = await fetch(apiUrl("/history"), {
    headers: buildHeaders(credential, false),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to load history");
  }

  const payload = await response.json();
  return payload.items as PRSummary[];
}

export async function deleteHistoryItem(credential: string, summaryId: string): Promise<void> {
  const response = await fetch(apiUrl(`/history/${summaryId}`), {
    method: "DELETE",
    headers: buildHeaders(credential, false),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to delete history item");
  }
}

export async function saveHistorySummary(
  credential: string | undefined,
  summary: PRSummary
): Promise<{ id: string }> {
  const response = await fetch(apiUrl("/api/history"), {
    method: "POST",
    headers: buildHeaders(credential ?? null),
    body: JSON.stringify(summary),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to save history");
  }

  return response.json();
}

export type SummaryStreamPayload = {
  pr_url?: string;
  diff_text?: string;
  repo?: string;
  pr_number?: number;
  title?: string;
  author?: string;
};

export type SummaryStreamEventHandlers = {
  onStage?: (message: string) => void;
  onFile?: (file: { filename: string; status: string; additions: number; deletions: number; patch?: string | null }) => void;
  onAgent?: (event: { step: string; agent: string; status: string; message: string; details?: Record<string, unknown> }) => void;
  onSummary?: (summary: PRSummary) => void;
  onError?: (message: string) => void;
};

function parseSseBlock(block: string) {
  const normalized = block.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter(Boolean);
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  return {
    eventName,
    data: dataLines.join("\n"),
  };
}

export async function streamSummary(
  credential: string,
  payload: SummaryStreamPayload,
  handlers: SummaryStreamEventHandlers
): Promise<PRSummary | null> {
  let response: Response | null = null;
  const streamEndpoints = ["/api/summarize/stream", "/summarize-pr/stream"];

  for (const endpoint of streamEndpoints) {
    const candidate = await fetch(apiUrl(endpoint), {
      method: "POST",
      headers: buildHeaders(credential),
      body: JSON.stringify(payload),
    });

    if (candidate.ok && candidate.body) {
      response = candidate;
      break;
    }

    if (candidate.status !== 404) {
      response = candidate;
      break;
    }
  }

  if (!response || !response.ok || !response.body) {
    const error = await response?.json().catch(() => ({}));
    throw new Error(error.detail || "Failed to start summarization");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let summary: PRSummary | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    let boundaryIndex = buffer.indexOf("\n\n");
    while (boundaryIndex !== -1) {
      const rawBlock = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);

      const parsed = parseSseBlock(rawBlock);
      if (parsed.data) {
        const payloadData = JSON.parse(parsed.data);
        if (parsed.eventName === "stage") {
          handlers.onStage?.(payloadData.message);
        }
        if (parsed.eventName === "file") {
          handlers.onFile?.(payloadData);
        }
        if (parsed.eventName === "agent") {
          handlers.onAgent?.(payloadData);
        }
        if (parsed.eventName === "summary") {
          summary = payloadData as PRSummary;
          handlers.onSummary?.(summary);
        }
        if (parsed.eventName === "error") {
          handlers.onError?.(payloadData.message || "Summarization failed");
        }
      }

      boundaryIndex = buffer.indexOf("\n\n");
    }
  }

  return summary;
}
