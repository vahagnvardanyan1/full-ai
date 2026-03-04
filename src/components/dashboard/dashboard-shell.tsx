"use client";

import { Sidebar } from "./sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--bg)] p-2 gap-2">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg)]">{children}</main>
    </div>
  );
}
