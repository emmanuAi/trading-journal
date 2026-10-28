"use client";
import * as React from "react";
import { toast } from "sonner";
import { Plus, X, Trash2, Download, Star, Pencil } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { useAccountContext } from "@/components/layout/account-context";
import { useSettings } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import type { AccountType } from "@/lib/types";

export function SettingsClient({ initialFirstName, initialLastName }: { initialFirstName: string; initialLastName: string }) {
  const { accounts, refreshAccounts } = useAccountContext();
  const { settings, refresh } = useSettings();

  const [profile, setProfile] = React.useState({ firstName: initialFirstName, lastName: initialLastName });
  const [savingProfile, setSavingProfile] = React.useState(false);

  const [form, setForm] = React.useState<{ baseCurrency: string; timezone: string; defaultRiskPercent: string } | null>(null);
  const [newStrategy, setNewStrategy] = React.useState("");
  const [newTag, setNewTag] = React.useState("");
  const [strategies, setStrategies] = React.useState<string[]>([]);
  const [customTags, setCustomTags] = React.useState<string[]>([]);
  const [accountDialogOpen, setAccountDialogOpen] = React.useState(false);
  const [clearDemoOpen, setClearDemoOpen] = React.useState(false);
  const [newAccount, setNewAccount] = React.useState({ name: "", type: "personal" as AccountType, baseCurrency: "EUR", startingBalance: "10000" });
  const [editAccountId, setEditAccountId] = React.useState<string | null>(null);
  const [editAccount, setEditAccount] = React.useState({ name: "", type: "personal" as AccountType, baseCurrency: "EUR", startingBalance: "" });
  const [savingEditAccount, setSavingEditAccount] = React.useState(false);

  React.useEffect(() => {
    if (settings && !form) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({ baseCurrency: settings.baseCurrency, timezone: settings.timezone, defaultRiskPercent: String(settings.defaultRiskPercent) });
      setStrategies(settings.strategies);
      setCustomTags(settings.customTags);
    }
  }, [settings, form]);

  async function saveProfile() {
    if (!profile.firstName.trim()) {
      toast.error("First name is required.");
      return;
    }
    setSavingProfile(true);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: profile.firstName.trim(), lastName: profile.lastName.trim() }),
    });
    setSavingProfile(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to update profile." }));
      toast.error(data.error ?? "Failed to update profile.");
      return;
    }
    toast.success("Profile updated.");
  }

  async function saveGeneral() {
    if (!form) return;
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseCurrency: form.baseCurrency, timezone: form.timezone, defaultRiskPercent: Number(form.defaultRiskPercent) }),
    });
    if (!res.ok) {
      toast.error("Failed to save settings.");
      return;
    }
    toast.success("Settings saved.");
    refresh();
  }

  async function saveLists(nextStrategies: string[], nextTags: string[]) {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategies: nextStrategies, customTags: nextTags }),
    });
    if (res.ok) refresh();
  }

  async function toggleDemoData(show: boolean) {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showDemoData: show }),
    });
    if (res.ok) {
      toast.success(show ? "Demo data shown." : "Demo data hidden.");
      refresh();
    }
  }

  async function toggleAutoWeeklyReports(enabled: boolean) {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoWeeklyReportsEnabled: enabled }),
    });
    if (res.ok) {
      toast.success(enabled ? "Automated weekly reports enabled." : "Automated weekly reports disabled.");
      refresh();
    } else {
      toast.error("Failed to update automated reports preference.");
    }
  }

  async function clearDemo() {
    await fetch("/api/settings", { method: "DELETE" });
    toast.success("Demo trades removed.");
    setClearDemoOpen(false);
    refresh();
    refreshAccounts();
  }

  async function createAccount() {
    if (!newAccount.name.trim()) {
      toast.error("Account name is required.");
      return;
    }
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newAccount, startingBalance: Number(newAccount.startingBalance) }),
    });
    if (!res.ok) {
      toast.error("Failed to create account.");
      return;
    }
    toast.success("Account created.");
    setAccountDialogOpen(false);
    setNewAccount({ name: "", type: "personal", baseCurrency: "EUR", startingBalance: "10000" });
    refreshAccounts();
  }

  async function setDefaultAccount(id: string) {
    await fetch(`/api/accounts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isDefault: true }) });
    refreshAccounts();
  }

  function openEditAccount(id: string) {
    const a = accounts.find((acc) => acc.id === id);
    if (!a) return;
    setEditAccount({ name: a.name, type: a.type, baseCurrency: a.baseCurrency, startingBalance: String(a.startingBalance) });
    setEditAccountId(id);
  }

  async function saveEditAccount() {
    if (!editAccountId) return;
    if (!editAccount.name.trim()) {
      toast.error("Account name is required.");
      return;
    }
    const balance = Number(editAccount.startingBalance);
    if (!Number.isFinite(balance) || balance < 0) {
      toast.error("Starting balance must be a valid, non-negative number.");
      return;
    }
    setSavingEditAccount(true);
    const res = await fetch(`/api/accounts/${editAccountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editAccount, startingBalance: balance }),
    });
    setSavingEditAccount(false);
    if (!res.ok) {
      toast.error("Failed to update account.");
      return;
    }
    toast.success("Account updated. Historical trades keep their own recorded balances.");
    setEditAccountId(null);
    refreshAccounts();
  }

  async function deleteAccount(id: string) {
    if (accounts.length <= 1) {
      toast.error("You need at least one account.");
      return;
    }
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    toast.success("Account deleted.");
    refreshAccounts();
  }

  if (!form) {
    return (
      <div>
        <Topbar title="Settings" />
        <div className="p-8">
          <div className="h-64 animate-pulse rounded-xl bg-surface" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Settings" description="Accounts, risk defaults, strategies, tags and data." />
      <div className="p-4 lg:p-8 flex flex-col gap-6 max-w-4xl">
        <Card id="profile">
          <CardHeader>
            <CardTitle className="text-foreground text-base font-semibold">Profile</CardTitle>
            <CardDescription>Your name is private to your account and only used to personalize your dashboard greeting.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>First Name</Label>
              <Input
                value={profile.firstName}
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                placeholder="e.g. Emmanuel"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Last Name</Label>
              <Input
                value={profile.lastName}
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                placeholder="e.g. Safari"
              />
            </div>
          </CardContent>
          <CardContent className="pt-0">
            <Button size="sm" onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-foreground text-base font-semibold">Accounts</CardTitle>
              <CardDescription>Personal accounts and prop firm challenges, each with a separate dashboard.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setAccountDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> New Account
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{a.name}</span>
                  <Badge variant={a.type === "prop_firm" ? "warning" : "accent"}>{a.type === "prop_firm" ? "Prop Firm" : "Personal"}</Badge>
                  {a.isDefault && <Badge variant="profit">Default</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {a.baseCurrency} · starting {a.startingBalance.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEditAccount(a.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-accent" title="Edit account">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {!a.isDefault && (
                    <button onClick={() => setDefaultAccount(a.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-accent" title="Set as default">
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button onClick={() => deleteAccount(a.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-loss" title="Delete account">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base font-semibold">General</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Base Currency</Label>
              <Select value={form.baseCurrency} onValueChange={(v) => setForm({ ...form, baseCurrency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Time Zone</Label>
              <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="Europe/Amsterdam" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Default Risk %</Label>
              <Input type="number" step="any" value={form.defaultRiskPercent} onChange={(e) => setForm({ ...form, defaultRiskPercent: e.target.value })} />
            </div>
          </CardContent>
          <CardContent className="pt-0">
            <Button size="sm" onClick={saveGeneral}>
              Save General Settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base font-semibold">Strategies</CardTitle>
            <CardDescription>Used in the trade form and analytics breakdowns.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {strategies.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    const next = strategies.filter((x) => x !== s);
                    setStrategies(next);
                    saveLists(next, customTags);
                  }}
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs hover:border-loss/40 hover:text-loss"
                >
                  {s} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
            <div className="flex gap-2 max-w-sm">
              <Input value={newStrategy} onChange={(e) => setNewStrategy(e.target.value)} placeholder="Add a strategy…" />
              <Button
                variant="outline"
                onClick={() => {
                  if (!newStrategy.trim()) return;
                  const next = [...strategies, newStrategy.trim()];
                  setStrategies(next);
                  saveLists(next, customTags);
                  setNewStrategy("");
                }}
              >
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base font-semibold">Custom Tags</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {customTags.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    const next = customTags.filter((x) => x !== t);
                    setCustomTags(next);
                    saveLists(strategies, next);
                  }}
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs hover:border-loss/40 hover:text-loss"
                >
                  {t} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
            <div className="flex gap-2 max-w-sm">
              <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add a tag…" />
              <Button
                variant="outline"
                onClick={() => {
                  if (!newTag.trim()) return;
                  const next = [...customTags, newTag.trim()];
                  setCustomTags(next);
                  saveLists(strategies, next);
                  setNewTag("");
                }}
              >
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base font-semibold">Demo Data</CardTitle>
            <CardDescription>Demo trades preview the dashboard and are always flagged separately from your real trades.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch checked={settings?.showDemoData ?? true} onCheckedChange={toggleDemoData} />
              <span className="text-sm">Show demo data alongside real trades</span>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setClearDemoOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Clear Demo Data
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base font-semibold">AI Coach</CardTitle>
            <CardDescription>
              When on, an automated weekly report is generated for you every week you have closed trades — across all your
              accounts combined. Off by default; counts against the same shared AI budget as the Coach chat and on-demand
              reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Switch checked={settings?.autoWeeklyReportsEnabled ?? false} onCheckedChange={toggleAutoWeeklyReports} />
            <span className="text-sm">Automatically generate a weekly AI report</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base font-semibold">Data &amp; Backup</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/api/export/backup" download>
                <Download className="h-3.5 w-3.5" /> Download Full Backup (JSON)
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/export/csv" download>
                <Download className="h-3.5 w-3.5" /> Export Trades (CSV)
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Account</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={newAccount.name} onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })} placeholder="e.g. FTMO Challenge" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select value={newAccount.type} onValueChange={(v) => setNewAccount({ ...newAccount, type: v as AccountType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="prop_firm">Prop Firm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Base Currency</Label>
                <Select value={newAccount.baseCurrency} onValueChange={(v) => setNewAccount({ ...newAccount, baseCurrency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Starting Balance</Label>
                <Input type="number" value={newAccount.startingBalance} onChange={(e) => setNewAccount({ ...newAccount, startingBalance: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={createAccount}>Create Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editAccountId !== null} onOpenChange={(open) => !open && setEditAccountId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={editAccount.name} onChange={(e) => setEditAccount({ ...editAccount, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select value={editAccount.type} onValueChange={(v) => setEditAccount({ ...editAccount, type: v as AccountType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="prop_firm">Prop Firm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Base Currency</Label>
                <Select value={editAccount.baseCurrency} onValueChange={(v) => setEditAccount({ ...editAccount, baseCurrency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Starting Balance</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={editAccount.startingBalance}
                  onChange={(e) => setEditAccount({ ...editAccount, startingBalance: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Changing the starting balance updates this account&apos;s current balance (starting balance + realized P&amp;L) going
              forward. Your existing trades and their recorded account-balance-at-entry values are never changed.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={saveEditAccount} disabled={savingEditAccount}>
              {savingEditAccount ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearDemoOpen} onOpenChange={setClearDemoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear demo data?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This permanently deletes every demo trade. Your real trades are not affected.</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={clearDemo}>
              Clear demo data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
