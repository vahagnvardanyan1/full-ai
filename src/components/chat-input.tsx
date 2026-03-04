"use client";

import { CSSProperties, useRef, KeyboardEvent } from "react";

// ── Icons ────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <path
        d="M2 8L14 2L8 14L7 9L2 8Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}

function SpinnerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── Component ────────────────────────────────────────────

interface ChatInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
}

export function ChatInput({ onSubmit, disabled, loading, compact }: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const value = ref.current?.value.trim();
    if (!value || disabled || loading) return;
    onSubmit(value);
    if (ref.current) ref.current.value = "";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  if (compact) {
    return <CompactInput
      inputRef={ref}
      disabled={disabled}
      loading={loading}
      onKeyDown={handleKeyDown}
      onSubmit={handleSubmit}
    />;
  }

  return <HeroInput
    inputRef={ref}
    disabled={disabled}
    loading={loading}
    onKeyDown={handleKeyDown}
    onSubmit={handleSubmit}
  />;
}

// ── Hero variant (landing page) ──────────────────────────

const heroForm: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "flex-end",
};

const heroTextarea: CSSProperties = {
  flex: 1,
  minHeight: 72,
  maxHeight: 200,
  padding: "1rem 1.25rem",
  borderRadius: 16,
  border: "1px solid var(--glass-border)",
  background: "var(--glass-bg)",
  backdropFilter: "blur(var(--glass-blur))",
  WebkitBackdropFilter: "blur(var(--glass-blur))",
  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
  color: "var(--text)",
  fontSize: "0.95rem",
  fontFamily: "inherit",
  resize: "vertical",
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

const heroBtnBase: CSSProperties = {
  padding: "0.75rem 1.35rem",
  borderRadius: 14,
  border: "none",
  background: "linear-gradient(135deg, #3b82f6, #2563eb)",
  color: "#fff",
  fontWeight: 600,
  fontSize: "0.9rem",
  cursor: "pointer",
  transition: "opacity 0.15s, transform 0.15s, box-shadow 0.15s",
  whiteSpace: "nowrap",
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
  boxShadow: "0 2px 14px rgba(59, 130, 246, 0.3)",
};

interface InputVariantProps {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean;
  loading?: boolean;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
}

function HeroInput({ inputRef, disabled, loading, onKeyDown, onSubmit }: InputVariantProps) {
  const isOff = disabled || loading;

  const btnStyle: CSSProperties = loading
    ? { ...heroBtnBase, opacity: 0.7, cursor: "default", pointerEvents: "none" }
    : isOff
      ? { ...heroBtnBase, opacity: 0.4, cursor: "not-allowed", boxShadow: "none" }
      : heroBtnBase;

  return (
    <div style={heroForm}>
      <textarea
        ref={inputRef}
        rows={3}
        style={heroTextarea}
        placeholder="Describe a feature, bug, or request for your AI team..."
        disabled={isOff}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--accent)";
          e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-glow), inset 0 1px 3px rgba(0,0,0,0.06)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--glass-border)";
          e.currentTarget.style.boxShadow = "inset 0 1px 3px rgba(0,0,0,0.06)";
        }}
      />
      <button
        style={btnStyle}
        onClick={onSubmit}
        disabled={isOff}
        onMouseEnter={(e) => {
          if (!isOff) {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 4px 20px rgba(59, 130, 246, 0.4)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 2px 14px rgba(59, 130, 246, 0.3)";
        }}
      >
        {loading ? <SpinnerIcon size={16} /> : <SendIcon />}
        {loading ? "Sending..." : "Send"}
      </button>
    </div>
  );
}

// ── Compact variant (bottom bar) ─────────────────────────

const compactWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 0,
  border: "1px solid var(--glass-border)",
  borderRadius: 12,
  background: "var(--glass-bg)",
  backdropFilter: "blur(var(--glass-blur))",
  WebkitBackdropFilter: "blur(var(--glass-blur))",
  transition: "border-color 0.2s, box-shadow 0.2s",
  overflow: "hidden",
};

const compactTextarea: CSSProperties = {
  flex: 1,
  height: 38,
  minHeight: 38,
  maxHeight: 38,
  padding: "0 0.85rem",
  border: "none",
  background: "transparent",
  color: "var(--text)",
  fontSize: "0.82rem",
  fontFamily: "inherit",
  resize: "none",
  outline: "none",
  lineHeight: "38px",
};

const compactBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.35rem",
  padding: "0 0.85rem",
  height: 38,
  border: "none",
  borderLeft: "1px solid var(--glass-border)",
  background: "transparent",
  color: "var(--accent)",
  fontSize: "0.78rem",
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 0.15s, color 0.15s",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

function CompactInput({ inputRef, disabled, loading, onKeyDown, onSubmit }: InputVariantProps) {
  const isOff = disabled || loading;

  const btnStyle: CSSProperties = isOff
    ? { ...compactBtn, opacity: 0.4, cursor: "not-allowed" }
    : compactBtn;

  return (
    <div
      style={compactWrap}
      onFocus={(e) => {
        const wrap = e.currentTarget;
        wrap.style.borderColor = "var(--accent)";
        wrap.style.boxShadow = "0 0 0 2px var(--accent-glow)";
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          const wrap = e.currentTarget;
          wrap.style.borderColor = "var(--glass-border)";
          wrap.style.boxShadow = "none";
        }
      }}
    >
      <textarea
        ref={inputRef}
        rows={1}
        style={compactTextarea}
        placeholder="Follow-up message..."
        disabled={isOff}
        onKeyDown={onKeyDown}
      />
      <button
        style={btnStyle}
        onClick={onSubmit}
        disabled={isOff}
        onMouseEnter={(e) => {
          if (!isOff) e.currentTarget.style.background = "var(--surface-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {loading ? <SpinnerIcon size={13} /> : <SendIcon />}
        {loading ? "Sending" : "Send"}
      </button>
    </div>
  );
}
