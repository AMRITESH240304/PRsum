import { AppSettings, AuthUser } from "@/types";

// Simple React-compatible store using module-level state + listeners
type Listener = () => void;

const AUTH_STORAGE_KEY = "prsum.auth";

function loadStoredAuth(): { user: AuthUser; credential: string } | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as { user: AuthUser; credential: string };
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function persistAuth(user: AuthUser | null, credential: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!user || !credential) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, credential }));
}

let state = {
  ...(() => {
    const storedAuth = loadStoredAuth();
    return {
      user: storedAuth?.user ?? null,
      credential: storedAuth?.credential ?? null,
    };
  })(),
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

export function setAuth(user: AuthUser | null, credential: string | null) {
  state = { ...state, user, credential };
  persistAuth(user, credential);
  notify();
}

export function clearAuth() {
  state = { ...state, user: null, credential: null };
  persistAuth(null, null);
  notify();
}

export function updateSettings(partial: Partial<AppSettings>) {
  state = { ...state, settings: { ...state.settings, ...partial } };
  notify();
}
