/** Reusable Tailwind class constants for common patterns */

export const glassCard =
  "bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] [-webkit-backdrop-filter:blur(var(--glass-blur))] border border-[var(--glass-border)] rounded-[var(--radius-lg)]";

export const panelBase =
  "bg-[var(--panel-bg)] backdrop-blur-[24px] [-webkit-backdrop-filter:blur(24px)] border border-[var(--panel-border)]";

export const pillBase =
  "inline-block px-[0.4rem] py-[0.1rem] rounded-full text-[0.6rem] font-semibold uppercase tracking-wide";

export const sectionLabel =
  "text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] mb-2";

export const closeBtnBase =
  "ml-auto bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-lg w-7 h-7 flex items-center justify-center cursor-pointer text-[var(--text-muted)] text-[0.85rem] transition-colors hover:bg-[var(--surface-hover)]";

export const textGradientTitle =
  "bg-gradient-to-br from-[var(--gradient-title-from)] to-[var(--gradient-title-to)] bg-clip-text text-transparent";
