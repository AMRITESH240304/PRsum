import { Link, useLocation } from "react-router-dom";
import { GitPullRequest, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/hooks/use-store";
import { updateSettings } from "@/store/app-store";

const navItems = [
  { label: "Home", path: "/" },
  { label: "Summarize", path: "/summarize" },
  { label: "History", path: "/history" },
  { label: "Settings", path: "/settings" },
];

export function Navbar() {
  const { settings } = useAppStore();
  const location = useLocation();

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

        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {settings.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}
