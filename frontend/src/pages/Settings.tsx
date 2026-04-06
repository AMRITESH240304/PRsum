import { Navbar } from "@/components/Navbar";
import { useAppStore } from "@/hooks/use-store";
import { updateSettings } from "@/store/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { KeyRound, Github, Settings2, Palette } from "lucide-react";

export default function Settings() {
  const { settings } = useAppStore();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-2xl py-6">
        <h1 className="mb-6 text-2xl font-bold text-foreground">Settings</h1>

        <div className="space-y-4">
          {/* GitHub */}
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Github className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">GitHub</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="github" className="text-sm">Personal Access Token</Label>
                <Input
                  id="github"
                  type="password"
                  value={settings.githubToken}
                  onChange={(e) => updateSettings({ githubToken: e.target.value })}
                  placeholder="ghp_..."
                  className="border-border bg-surface font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Required for fetching diffs from private repositories.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Output Preferences */}
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Settings2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Output Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="changelog" className="text-sm">Include changelog entry</Label>
                <Switch
                  id="changelog"
                  checked={settings.includeChangelog}
                  onCheckedChange={(v) => updateSettings({ includeChangelog: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="checklist" className="text-sm">Include review checklist</Label>
                <Switch
                  id="checklist"
                  checked={settings.includeChecklist}
                  onCheckedChange={(v) => updateSettings({ includeChecklist: v })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Theme */}
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Palette className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Appearance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="darkmode" className="text-sm">Dark mode</Label>
                <Switch
                  id="darkmode"
                  checked={settings.theme === "dark"}
                  onCheckedChange={(v) => {
                    const theme = v ? "dark" : "light";
                    updateSettings({ theme });
                    document.documentElement.classList.toggle("dark", v);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
