import { PRSummary } from "@/types";

export const mockSummary: PRSummary = {
  id: "1",
  repoName: "acme/web-app",
  prNumber: 142,
  prTitle: "Add user authentication flow with OAuth2",
  date: new Date().toISOString(),
  summary:
    "This PR implements a complete OAuth2 authentication flow including login, signup, and token refresh. It adds protected route wrappers and a new auth context provider that manages session state across the application.",
  changes: [
    { type: "feat", description: "Add OAuth2 login and signup pages with form validation" },
    { type: "feat", description: "Create AuthProvider context with session management" },
    { type: "feat", description: "Add protected route HOC for authenticated pages" },
    { type: "fix", description: "Fix redirect loop on expired sessions" },
    { type: "refactor", description: "Extract API client into standalone module" },
    { type: "chore", description: "Update dependencies and add auth-related env vars" },
  ],
  filesAffected: [
    { filename: "src/contexts/AuthContext.tsx", changeType: "feat", additions: 124, deletions: 0 },
    { filename: "src/pages/Login.tsx", changeType: "feat", additions: 89, deletions: 0 },
    { filename: "src/pages/Signup.tsx", changeType: "feat", additions: 76, deletions: 0 },
    { filename: "src/components/ProtectedRoute.tsx", changeType: "feat", additions: 32, deletions: 0 },
    { filename: "src/lib/api-client.ts", changeType: "refactor", additions: 45, deletions: 78 },
    { filename: "src/App.tsx", changeType: "fix", additions: 12, deletions: 8 },
    { filename: "package.json", changeType: "chore", additions: 3, deletions: 1 },
  ],
  changelog: `## [1.4.0] - ${new Date().toISOString().split("T")[0]}

### Added
- OAuth2 authentication flow (login, signup, token refresh)
- Protected route wrapper component
- Auth context provider with session management

### Fixed
- Redirect loop on expired sessions

### Changed
- Extracted API client into standalone module
- Updated auth-related dependencies`,
  checklist: [
    { id: "1", label: "Auth tokens stored securely (httpOnly cookies)", checked: false },
    { id: "2", label: "Rate limiting on login endpoint", checked: false },
    { id: "3", label: "Error states handled for network failures", checked: false },
    { id: "4", label: "Unit tests for AuthContext", checked: false },
    { id: "5", label: "Redirect logic tested for edge cases", checked: false },
    { id: "6", label: "Environment variables documented", checked: false },
  ],
};

export const mockHistory: PRSummary[] = [
  mockSummary,
  {
    id: "2",
    repoName: "acme/api-server",
    prNumber: 87,
    prTitle: "Migrate database queries to prepared statements",
    date: new Date(Date.now() - 86400000).toISOString(),
    summary:
      "Migrates all raw SQL queries to parameterized prepared statements to prevent SQL injection vulnerabilities. Includes query performance benchmarks showing 15% improvement.",
    changes: [
      { type: "fix", description: "Replace raw SQL with prepared statements across all repositories" },
      { type: "refactor", description: "Consolidate database connection pooling logic" },
      { type: "chore", description: "Add SQL injection test suite" },
    ],
    filesAffected: [
      { filename: "src/repositories/UserRepo.ts", changeType: "fix", additions: 34, deletions: 45 },
      { filename: "src/repositories/OrderRepo.ts", changeType: "fix", additions: 28, deletions: 39 },
      { filename: "src/db/pool.ts", changeType: "refactor", additions: 18, deletions: 42 },
      { filename: "tests/sql-injection.test.ts", changeType: "chore", additions: 67, deletions: 0 },
    ],
    changelog: `## [2.1.1] - ${new Date(Date.now() - 86400000).toISOString().split("T")[0]}\n\n### Fixed\n- SQL injection vulnerability in user and order repositories\n\n### Changed\n- Database connection pooling consolidated`,
    checklist: [
      { id: "1", label: "All queries parameterized", checked: false },
      { id: "2", label: "Performance benchmarks acceptable", checked: false },
      { id: "3", label: "SQL injection tests passing", checked: false },
    ],
  },
  {
    id: "3",
    repoName: "acme/mobile-app",
    prNumber: 231,
    prTitle: "Implement push notification system",
    date: new Date(Date.now() - 172800000).toISOString(),
    summary:
      "Adds Firebase Cloud Messaging integration for push notifications. Supports both foreground and background message handling with custom notification channels on Android.",
    changes: [
      { type: "feat", description: "Integrate FCM for push notifications" },
      { type: "feat", description: "Add notification permission flow" },
      { type: "fix", description: "Fix notification icon rendering on Android 12+" },
    ],
    filesAffected: [
      { filename: "src/services/notifications.ts", changeType: "feat", additions: 98, deletions: 0 },
      { filename: "src/hooks/useNotifications.ts", changeType: "feat", additions: 45, deletions: 0 },
      { filename: "android/app/src/main/AndroidManifest.xml", changeType: "fix", additions: 8, deletions: 2 },
    ],
    changelog: `## [3.0.0] - ${new Date(Date.now() - 172800000).toISOString().split("T")[0]}\n\n### Added\n- Push notification support via FCM\n- Notification permission request flow`,
    checklist: [
      { id: "1", label: "Notifications work in foreground and background", checked: false },
      { id: "2", label: "Permission flow handles denial gracefully", checked: false },
    ],
  },
  {
    id: "4",
    repoName: "acme/design-system",
    prNumber: 56,
    prTitle: "Add dark mode support to component library",
    date: new Date(Date.now() - 432000000).toISOString(),
    summary:
      "Extends the design system with full dark mode support using CSS custom properties. All 24 components updated with dark variants and theme switching utility.",
    changes: [
      { type: "feat", description: "Add dark mode CSS custom properties" },
      { type: "feat", description: "Create ThemeProvider component" },
      { type: "refactor", description: "Convert hardcoded colors to design tokens" },
      { type: "chore", description: "Update Storybook with dark mode toggle" },
    ],
    filesAffected: [
      { filename: "src/theme/tokens.css", changeType: "feat", additions: 156, deletions: 0 },
      { filename: "src/components/ThemeProvider.tsx", changeType: "feat", additions: 43, deletions: 0 },
      { filename: "src/components/Button.tsx", changeType: "refactor", additions: 12, deletions: 18 },
      { filename: ".storybook/preview.tsx", changeType: "chore", additions: 15, deletions: 3 },
    ],
    changelog: `## [1.2.0] - ${new Date(Date.now() - 432000000).toISOString().split("T")[0]}\n\n### Added\n- Dark mode support across all components\n- ThemeProvider for theme switching`,
    checklist: [
      { id: "1", label: "All components render correctly in both themes", checked: false },
      { id: "2", label: "Theme preference persists across sessions", checked: false },
    ],
  },
];

export const mockDiff = `diff --git a/src/contexts/AuthContext.tsx b/src/contexts/AuthContext.tsx
new file mode 100644
--- /dev/null
+++ b/src/contexts/AuthContext.tsx
@@ -0,0 +1,45 @@
+import React, { createContext, useContext, useState } from 'react';
+
+interface AuthState {
+  user: User | null;
+  token: string | null;
+  isAuthenticated: boolean;
+}
+
+const AuthContext = createContext<AuthState | null>(null);
+
+export function AuthProvider({ children }: { children: React.ReactNode }) {
+  const [user, setUser] = useState<User | null>(null);
+  const [token, setToken] = useState<string | null>(null);
+
+  const login = async (email: string, password: string) => {
+    const response = await fetch('/api/auth/login', {
+      method: 'POST',
+      body: JSON.stringify({ email, password }),
+    });
+    const data = await response.json();
+    setUser(data.user);
+    setToken(data.token);
+  };
+
+  return (
+    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user }}>
+      {children}
+    </AuthContext.Provider>
+  );
+}`;
