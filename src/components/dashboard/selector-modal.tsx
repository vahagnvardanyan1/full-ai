"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";

// ── Types ───────────────────────────────────────────────

export interface SelectorItem {
  id: string;
  label: string;
  description?: string;
  badge?: string;
}

interface SelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: SelectorItem[];
  loading: boolean;
  onSelect: (id: string) => void;
  service?: "github" | "jira" | "vercel";
}

// ── Service config ──────────────────────────────────────

const SERVICE_CONFIG = {
  github: {
    accent: "#8b5cf6",
    accentBg: "rgba(139, 92, 246, 0.08)",
    accentBorder: "rgba(139, 92, 246, 0.15)",
    accentGlow: "rgba(139, 92, 246, 0.06)",
    searchPlaceholder: "Search repositories...",
    emptyTitle: "No repositories found",
    emptySubtitle: "Try a different search or check your GitHub permissions",
    countLabel: "repo",
    countLabelPlural: "repos",
    icon: (
      <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  jira: {
    accent: "#2684ff",
    accentBg: "rgba(38, 132, 255, 0.08)",
    accentBorder: "rgba(38, 132, 255, 0.15)",
    accentGlow: "rgba(38, 132, 255, 0.06)",
    searchPlaceholder: "Search projects...",
    emptyTitle: "No projects found",
    emptySubtitle: "Try a different search or check your Jira permissions",
    countLabel: "project",
    countLabelPlural: "projects",
    icon: (
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <path
          d="M11.53 2c0 3.58 2.91 6.49 6.49 6.49h1.45v1.42c0 3.58 2.91 6.49 6.49 6.49V2.51A.51.51 0 0 0 25.45 2H11.53z"
          fill="#2684ff"
          transform="scale(0.82) translate(-2, 0)"
        />
        <path
          d="M8.12 5.45c-.03 3.58 2.86 6.52 6.44 6.55h1.47v1.42c0 3.58 2.91 6.49 6.49 6.49V5.97a.51.51 0 0 0-.51-.52H8.12z"
          fill="#2684ff"
          opacity="0.7"
          transform="scale(0.82) translate(-2, 0)"
        />
        <path
          d="M4.72 8.9c-.03 3.58 2.86 6.52 6.44 6.55h1.47v1.42c0 3.58 2.91 6.49 6.49 6.49V9.42a.51.51 0 0 0-.51-.52H4.72z"
          fill="#2684ff"
          opacity="0.45"
          transform="scale(0.82) translate(-2, 0)"
        />
      </svg>
    ),
  },
  vercel: {
    accent: "var(--text)",
    accentBg: "var(--surface-raised)",
    accentBorder: "var(--surface-border)",
    accentGlow: "var(--surface-hover)",
    searchPlaceholder: "Search projects...",
    emptyTitle: "No projects found",
    emptySubtitle: "Try a different search or check your Vercel permissions",
    countLabel: "project",
    countLabelPlural: "projects",
    icon: (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 1L24 22H0L12 1z" />
      </svg>
    ),
  },
} as const;

// ── Icons ───────────────────────────────────────────────

function RepoIcon({ isPrivate }: { isPrivate: boolean }) {
  if (isPrivate) {
    return (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    );
  }
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ProjectIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ── Helpers ─────────────────────────────────────────────

function groupByOwner(items: SelectorItem[]): Map<string, SelectorItem[]> {
  const groups = new Map<string, SelectorItem[]>();
  for (const item of items) {
    const slashIdx = item.label.indexOf("/");
    const owner = slashIdx > 0 ? item.label.slice(0, slashIdx) : "";
    const group = groups.get(owner) ?? [];
    group.push(item);
    groups.set(owner, group);
  }
  return groups;
}

// ── Component ───────────────────────────────────────────

export function SelectorModal({
  open,
  onOpenChange,
  title,
  items,
  loading,
  onSelect,
  service = "github",
}: SelectorModalProps) {
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [selecting, setSelecting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const config = SERVICE_CONFIG[service];
  const isGithub = service === "github";

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
    );
  }, [items, search]);

  // Group GitHub repos by owner for visual hierarchy
  const grouped = useMemo(() => {
    if (!isGithub || filtered.length === 0) return null;
    const g = groupByOwner(filtered);
    // Only show groups if there's more than one owner
    return g.size > 1 ? g : null;
  }, [filtered, isGithub]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setSearch("");
      setActiveIndex(0);
      setSelecting(null);
      // Focus search after animation
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Reset active index on filter change
  useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  const handleSelect = useCallback(
    (id: string) => {
      setSelecting(id);
      // Brief delay for selection animation
      setTimeout(() => {
        onSelect(id);
        setSearch("");
        setSelecting(null);
      }, 200);
    },
    [onSelect]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[activeIndex]) {
        e.preventDefault();
        handleSelect(filtered[activeIndex].id);
      }
    },
    [filtered, activeIndex, handleSelect]
  );

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector(`[data-index="${activeIndex}"]`);
    if (active) {
      active.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex]);

  const countLabel = filtered.length === 1 ? config.countLabel : config.countLabelPlural;

  // ── Render helpers ────────────────────────────────────

  const renderItem = (item: SelectorItem, index: number, showOwner = true) => {
    const isActive = index === activeIndex;
    const isSelecting = selecting === item.id;
    const isPrivate = item.badge === "private";

    // Parse owner/name for GitHub repos
    const slashIdx = item.label.indexOf("/");
    const owner = slashIdx > 0 ? item.label.slice(0, slashIdx) : "";
    const name = slashIdx > 0 ? item.label.slice(slashIdx + 1) : item.label;

    return (
      <button
        key={item.id}
        data-index={index}
        onClick={() => handleSelect(item.id)}
        onMouseEnter={() => setActiveIndex(index)}
        className="w-full text-left transition-all duration-150 cursor-pointer outline-none group/item"
        style={{
          animation: `selector-item-in 200ms ease ${Math.min(index * 30, 300)}ms both`,
        }}
      >
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
          style={{
            backgroundColor: isSelecting
              ? config.accentBg
              : isActive
                ? "var(--surface-hover)"
                : "transparent",
            borderLeft: isActive ? `2px solid ${config.accent}` : "2px solid transparent",
            paddingLeft: isActive ? "10px" : "12px",
          }}
        >
          {/* Icon */}
          <div
            className="size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150"
            style={{
              backgroundColor: isActive ? config.accentBg : "var(--surface-raised)",
              border: `1px solid ${isActive ? config.accentBorder : "var(--surface-border)"}`,
              color: isActive ? config.accent : "var(--text-muted)",
            }}
          >
            {isSelecting ? (
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={config.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "selector-check 200ms ease" }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : isGithub ? (
              <RepoIcon isPrivate={isPrivate} />
            ) : (
              <ProjectIcon />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {isGithub && showOwner && owner && (
                <span className="text-[0.75rem] text-[var(--text-muted)]">
                  {owner}/
                </span>
              )}
              <span
                className="text-[0.82rem] font-medium truncate"
                style={{ color: isActive ? "var(--text)" : "var(--text)" }}
              >
                {isGithub ? name : item.label}
              </span>
            </div>
            {item.description && (
              <p className="text-[0.7rem] text-[var(--text-muted)] mt-0.5 truncate leading-tight">
                {item.description}
              </p>
            )}
          </div>

          {/* Right side: badge + arrow */}
          <div className="flex items-center gap-2 shrink-0">
            {isPrivate && (
              <span
                className="px-2 py-0.5 rounded-md text-[0.62rem] font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: "rgba(139, 92, 246, 0.08)",
                  color: "#8b5cf6",
                  border: "1px solid rgba(139, 92, 246, 0.12)",
                }}
              >
                Private
              </span>
            )}
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="transition-all duration-150"
              style={{
                opacity: isActive ? 0.5 : 0,
                transform: isActive ? "translateX(0)" : "translateX(-4px)",
                color: "var(--text-muted)",
              }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
      </button>
    );
  };

  // Flat index mapping for grouped mode
  let flatIndex = 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[16px]"
          style={{ animation: "fade-in 150ms ease" }}
        />
        <Dialog.Content
          onKeyDown={handleKeyDown}
          className="fixed z-50 inset-0 m-auto w-[92vw] max-w-[520px] max-h-[75vh] h-fit flex flex-col rounded-2xl border overflow-hidden outline-none"
          style={{
            animation: "selector-modal-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
            backgroundColor: "var(--panel-bg)",
            borderColor: "var(--glass-border)",
            boxShadow: `0 24px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 80px ${config.accentGlow}`,
          }}
        >
          {/* Header */}
          <div
            className="px-5 pt-4 pb-0"
            style={{
              background: `linear-gradient(to bottom, ${config.accentGlow}, transparent)`,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="size-8 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: config.accentBg,
                    border: `1px solid ${config.accentBorder}`,
                    color: config.accent,
                  }}
                >
                  {config.icon}
                </div>
                <div>
                  <Dialog.Title className="text-[0.9rem] font-semibold text-[var(--text)] leading-tight">
                    {title}
                  </Dialog.Title>
                  {!loading && items.length > 0 && (
                    <p className="text-[0.68rem] text-[var(--text-muted)] mt-0.5">
                      {filtered.length} {countLabel}{search ? " matched" : " available"}
                    </p>
                  )}
                </div>
              </div>
              <Dialog.Close className="size-7 rounded-lg bg-[var(--surface-raised)] border border-[var(--surface-border)] flex items-center justify-center cursor-pointer text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">
                <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </Dialog.Close>
            </div>

            {/* Search */}
            <div className="relative mb-1">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                placeholder={config.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-20 py-2.5 rounded-xl bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[0.82rem] text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none transition-all"
                style={{
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              />
              {/* Keyboard hint */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded text-[0.58rem] font-medium text-[var(--text-muted)] bg-[var(--surface-hover)] border border-[var(--surface-border)]">
                  ↑↓
                </kbd>
                <kbd className="px-1.5 py-0.5 rounded text-[0.58rem] font-medium text-[var(--text-muted)] bg-[var(--surface-hover)] border border-[var(--surface-border)]">
                  ↵
                </kbd>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px mx-5 bg-[var(--surface-border)]" />

          {/* List */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
            {loading ? (
              <div className="flex flex-col gap-1.5 px-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ animation: `selector-item-in 200ms ease ${i * 60}ms both` }}
                  >
                    <div
                      className="size-8 rounded-lg animate-pulse shrink-0"
                      style={{ backgroundColor: "var(--surface-raised)" }}
                    />
                    <div className="flex-1">
                      <div
                        className="h-3.5 rounded-md animate-pulse mb-1.5"
                        style={{
                          backgroundColor: "var(--surface-raised)",
                          width: `${60 + Math.random() * 30}%`,
                        }}
                      />
                      <div
                        className="h-2.5 rounded-md animate-pulse"
                        style={{
                          backgroundColor: "var(--surface-raised)",
                          width: `${40 + Math.random() * 20}%`,
                          opacity: 0.5,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]"
                style={{ animation: "fade-in 300ms ease" }}
              >
                <div
                  className="size-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    backgroundColor: config.accentBg,
                    border: `1px solid ${config.accentBorder}`,
                  }}
                >
                  <svg
                    width={24}
                    height={24}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    style={{ color: config.accent, opacity: 0.6 }}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </div>
                <p className="text-[0.85rem] font-medium text-[var(--text)]">
                  {config.emptyTitle}
                </p>
                <p className="text-[0.72rem] mt-1 opacity-60 max-w-[260px] text-center leading-relaxed">
                  {search
                    ? `No results for "${search}"`
                    : config.emptySubtitle}
                </p>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="mt-3 px-3 py-1.5 rounded-lg text-[0.72rem] font-medium border cursor-pointer transition-colors"
                    style={{
                      backgroundColor: config.accentBg,
                      borderColor: config.accentBorder,
                      color: config.accent,
                    }}
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : grouped ? (
              // Grouped by owner (GitHub with multiple owners)
              <div className="flex flex-col gap-1">
                {Array.from(grouped.entries()).map(([owner, groupItems]) => (
                  <div key={owner}>
                    {/* Group header */}
                    <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1">
                      <div
                        className="size-5 rounded-full flex items-center justify-center text-[0.55rem] font-bold uppercase"
                        style={{
                          backgroundColor: config.accentBg,
                          border: `1px solid ${config.accentBorder}`,
                          color: config.accent,
                        }}
                      >
                        {owner.charAt(0)}
                      </div>
                      <span className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {owner}
                      </span>
                      <span className="text-[0.62rem] text-[var(--text-muted)] opacity-50">
                        {groupItems.length}
                      </span>
                    </div>
                    {/* Group items */}
                    {groupItems.map((item) => {
                      const idx = flatIndex++;
                      return renderItem(item, idx, false);
                    })}
                  </div>
                ))}
              </div>
            ) : (
              // Flat list
              <div className="flex flex-col gap-0.5">
                {filtered.map((item, i) => renderItem(item, i))}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && filtered.length > 0 && (
            <div
              className="px-5 py-2.5 flex items-center justify-between border-t"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <div className="flex items-center gap-3 text-[0.65rem] text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded text-[0.58rem] bg-[var(--surface-raised)] border border-[var(--surface-border)]">↑</kbd>
                  <kbd className="px-1 py-0.5 rounded text-[0.58rem] bg-[var(--surface-raised)] border border-[var(--surface-border)]">↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded text-[0.58rem] bg-[var(--surface-raised)] border border-[var(--surface-border)]">↵</kbd>
                  select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded text-[0.58rem] bg-[var(--surface-raised)] border border-[var(--surface-border)]">esc</kbd>
                  close
                </span>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>

      {/* Scoped keyframes */}
      <style>{`
        @keyframes selector-modal-in {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes selector-item-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes selector-check {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </Dialog.Root>
  );
}
