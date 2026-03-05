"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SIDEBAR_NAV } from "@/lib/dashboard/constants";
import { ThemeToggle } from "@/components/theme-toggle";
import { RufloStatus } from "@/components/dashboard/ruflo-status";

const ICONS: Record<string, (props: { size?: number }) => React.ReactNode> = {
  home: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  "layout-dashboard": ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="4" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="11" width="7" height="10" rx="1" />
    </svg>
  ),
  bot: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" />
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <circle cx="9" cy="14" r="1.5" fill="currentColor" />
      <circle cx="15" cy="14" r="1.5" fill="currentColor" />
    </svg>
  ),
  users: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  briefcase: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <path d="M2 13h20" />
    </svg>
  ),
  settings: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <div className={cn("flex flex-col h-full", collapsed ? "items-center" : "")}>
      {/* Logo */}
      <div className={cn("flex items-center gap-3 px-5 py-5 shrink-0", collapsed && "justify-center px-0")}>
        <Link href="/" className="flex items-center gap-3 no-underline hover:opacity-80 transition-opacity">
          <div className="size-8 rounded-full bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.25)] flex items-center justify-center shrink-0">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="#22c55e" strokeWidth="2" />
              <circle cx="12" cy="4" r="1.5" fill="#22c55e" opacity="0.7" />
              <circle cx="20" cy="12" r="1.5" fill="#22c55e" opacity="0.7" />
              <circle cx="12" cy="20" r="1.5" fill="#22c55e" opacity="0.7" />
              <circle cx="4" cy="12" r="1.5" fill="#22c55e" opacity="0.7" />
            </svg>
          </div>
          {!collapsed && (
            <span className="text-[0.95rem] font-bold font-[var(--font-display)] text-[var(--text)] tracking-[-0.01em]">
              AI Team
            </span>
          )}
        </Link>
      </div>

      {/* Divider */}
      <div className={cn("mx-4 mb-3 border-t border-[var(--surface-border)]", collapsed && "mx-2")} />

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {SIDEBAR_NAV.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[0.82rem] font-medium no-underline transition-all duration-150",
                active
                  ? "bg-[rgba(34,197,94,0.1)] text-[#22c55e] border border-[rgba(34,197,94,0.15)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] border border-transparent",
                collapsed && "justify-center px-2",
              )}
              title={collapsed ? item.label : undefined}
            >
              <span className="shrink-0">{Icon && <Icon />}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Ruflo MCP status */}
      {!collapsed && (
        <div className="px-3 mb-1">
          <RufloStatus />
        </div>
      )}

      {/* Bottom controls */}
      <div className={cn("px-3 py-4 shrink-0 flex items-center gap-2", collapsed ? "px-0 justify-center flex-col" : "justify-between")}>
        <ThemeToggle />
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="hidden lg:flex items-center justify-center size-8 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-raised)] text-[var(--text-muted)] cursor-pointer transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: collapsed ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden size-10 rounded-lg bg-[var(--panel-bg)] border border-[var(--panel-border)] backdrop-blur-[16px] flex items-center justify-center text-[var(--text-muted)] cursor-pointer"
      >
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - mobile */}
      <aside
        className={cn(
          "fixed top-2 left-2 bottom-2 z-50 w-[260px] lg:hidden transition-transform duration-300",
          "bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl",
          mobileOpen ? "translate-x-0" : "-translate-x-[calc(100%+8px)]",
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 size-8 rounded-lg bg-[var(--surface-raised)] border border-[var(--surface-border)] flex items-center justify-center text-[var(--text-muted)] cursor-pointer hover:text-[var(--text)]"
        >
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="4" y1="4" x2="12" y2="12" />
            <line x1="12" y1="4" x2="4" y2="12" />
          </svg>
        </button>
        {sidebarContent}
      </aside>

      {/* Sidebar - desktop */}
      <aside
        className={cn(
          "hidden lg:flex flex-col shrink-0 sticky top-0 transition-[width] duration-300",
          "bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl",
          "h-[calc(100vh-16px)]",
          collapsed ? "w-16" : "w-[260px]",
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
