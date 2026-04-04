import { PRSummary, AppSettings } from "@/types";
import { mockHistory } from "@/lib/mock-data";

// Simple React-compatible store using module-level state + listeners
type Listener = () => void;

let state = {
  history: mockHistory as PRSummary[],
  settings: {
    anthropicKey: "",
    githubToken: "",
    includeChangelog: true,
    includeChecklist: true,
    theme: "dark" as const,
  } as AppSettings,
};

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addToHistory(summary: PRSummary) {
  state = { ...state, history: [summary, ...state.history] };
  notify();
}

export function removeFromHistory(id: string) {
  state = { ...state, history: state.history.filter((s) => s.id !== id) };
  notify();
}

export function updateSettings(partial: Partial<AppSettings>) {
  state = { ...state, settings: { ...state.settings, ...partial } };
  notify();
}
