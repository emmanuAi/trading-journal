"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { useAccountContext } from "@/components/layout/account-context";
import { useSettings } from "@/lib/hooks";
import { TradeForm, defaultTradeFormValues, tradeFormValuesToInput, type TradeFormValues } from "@/components/trade-form/trade-form";
import { StagedScreenshotsPanel, revokeStagedScreenshots, type StagedScreenshot, type ScreenshotPhase } from "@/components/trade-form/staged-screenshot-uploader";
import { Card, CardContent } from "@/components/ui/card";

const PHASES: ScreenshotPhase[] = ["before", "during", "after"];

export default function NewTradePage() {
  const router = useRouter();
  const { accounts, activeAccountId } = useAccountContext();
  const { settings } = useSettings();
  const account = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];

  const [values, setValues] = React.useState<TradeFormValues | null>(null);
  const [staged, setStaged] = React.useState<StagedScreenshot[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (account && settings && !values) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues(defaultTradeFormValues({ accountBalance: account.startingBalance, riskPercent: settings.defaultRiskPercent }));
    }
  }, [account, settings, values]);

  // Staged screenshots live only as in-memory object URLs until the trade is created — release
  // them on unmount so navigating away mid-draft doesn't leak memory. Tracked via ref so the
  // cleanup always sees the latest list rather than the one captured on mount.
  const stagedRef = React.useRef(staged);
  React.useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);
  React.useEffect(() => {
    return () => revokeStagedScreenshots(stagedRef.current);
  }, []);

  async function uploadStagedScreenshots(tradeId: string): Promise<ScreenshotPhase[]> {
    const failedPhases: ScreenshotPhase[] = [];
    for (const phase of PHASES) {
      const files = staged.filter((s) => s.phase === phase).map((s) => s.file);
      if (files.length === 0) continue;
      try {
        const formData = new FormData();
        formData.set("phase", phase);
        files.forEach((f) => formData.append("files", f));
        const res = await fetch(`/api/trades/${tradeId}/screenshots`, { method: "POST", body: formData });
        if (!res.ok) failedPhases.push(phase);
      } catch {
        failedPhases.push(phase);
      }
    }
    return failedPhases;
  }

  async function handleSubmit() {
    // Guards against duplicate trades on a double-click/retry: once a trade is being created
    // the button is disabled, and we never re-POST /api/trades for the same submit.
    if (!values || !account || submitting) return;
    setSubmitting(true);
    let createdTradeId: string | null = null;
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradeFormValuesToInput(values, account.id)),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save trade.");
        setSubmitting(false);
        return;
      }
      createdTradeId = data.trade.id as string;
      toast.success(`Trade ${createdTradeId} saved.`);
    } catch {
      toast.error("Failed to save trade. Nothing was lost — your screenshots are still attached, try again.");
      setSubmitting(false);
      return;
    }

    // The trade is safely saved at this point. Screenshot upload failures are reported but never
    // roll back or duplicate the trade — the trade detail page can always retry a failed upload.
    if (staged.length > 0) {
      const failedPhases = await uploadStagedScreenshots(createdTradeId);
      if (failedPhases.length > 0) {
        toast.error(
          `Trade saved, but ${failedPhases.join(", ")} screenshot upload${failedPhases.length > 1 ? "s" : ""} failed. You can re-add them from the trade page.`
        );
      } else {
        toast.success(`${staged.length} screenshot${staged.length > 1 ? "s" : ""} uploaded.`);
      }
      revokeStagedScreenshots(staged);
    }

    router.push(`/journal/${createdTradeId}`);
  }

  return (
    <div>
      <Topbar title="Add New Trade" description="Log a trade in under two minutes — paste or attach screenshots before you save." />
      <div className="p-4 lg:p-8">
        {!account ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Create an account in Settings before logging a trade.
            </CardContent>
          </Card>
        ) : !values ? (
          <div className="h-64 animate-pulse rounded-xl bg-surface" />
        ) : (
          <Card>
            <CardContent className="p-6">
              <TradeForm
                values={values}
                onChange={setValues}
                strategies={settings?.strategies ?? []}
                onSubmit={handleSubmit}
                submitting={submitting}
                submitLabel="Create Trade"
                screenshotsPanel={<StagedScreenshotsPanel staged={staged} onChange={setStaged} />}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
