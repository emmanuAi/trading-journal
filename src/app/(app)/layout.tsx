import { Sidebar } from "@/components/layout/sidebar";
import { AccountProvider } from "@/components/layout/account-context";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccountProvider>
      <TooltipProvider delayDuration={200}>
        <div className="min-h-screen bg-background">
          <Sidebar />
          <main className="lg:pl-60">{children}</main>
        </div>
      </TooltipProvider>
    </AccountProvider>
  );
}
