import { Link, useLocation, useNavigate } from "react-router-dom";
import { GitPullRequest, LogOut, Moon, Sun, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/hooks/use-store";
import { clearAuth, updateSettings, setAuth } from "@/store/app-store";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { loginWithGoogle } from "@/lib/api";
import { toast } from "sonner";

const navItems = [
  { label: "Home", path: "/" },
  { label: "Summarize", path: "/summarize" },
  { label: "History", path: "/history" },
  { label: "Settings", path: "/settings" },
];

export function Navbar() {
  const { settings, user } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();

  const toggleTheme = () => {
    const next = settings.theme === "dark" ? "light" : "dark";
    updateSettings({ theme: next });
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-mono font-bold text-foreground">
          <GitPullRequest className="h-5 w-5 text-primary" />
          <span>PR<span className="text-primary">Sum</span></span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
              <UserCircle2 className="h-4 w-4 text-primary" />
              <span className="max-w-[160px] truncate text-xs font-medium text-foreground">
                {user.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  clearAuth();
                  toast.success("Signed out");
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <GoogleSignInButton
              compact
              onCredential={async (credential) => {
                try {
                  const response = await loginWithGoogle(credential);
                  setAuth(response.user, credential);
                  toast.success(`Signed in as ${response.user.name}`);
                  navigate("/summarize");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed to sign in");
                }
              }}
            />
          )}

          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {settings.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
