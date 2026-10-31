import { AppShell } from "@/components/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AppShell>
        <div id="main-content">{children}</div>
      </AppShell>
    </ErrorBoundary>
  );
}
