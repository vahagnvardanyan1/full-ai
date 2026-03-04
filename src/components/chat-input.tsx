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
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function ChatInput({ onSubmit, disabled, loading, compact, textareaRef }: ChatInputProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? internalRef;

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

const heroContainer: CSSProperties = {
  borderRadius: 16,
  border: "1px solid var(--glass-border)",
  background: "var(--glass-bg)",
  backdropFilter: "blur(var(--glass-blur))",
  WebkitBackdropFilter: "blur(var(--glass-blur))",
  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  transition: "border-color 0.2s, box-shadow 0.2s",
  overflow: "hidden",
};

const heroTextarea: CSSProperties = {
  width: "100%",
  minHeight: 80,
  maxHeight: 200,
  padding: "1rem 1.15rem 0.5rem",
  border: "none",
  background: "transparent",
  color: "var(--text)",
  fontSize: "0.92rem",
  fontFamily: "inherit",
  resize: "none",
  outline: "none",
  lineHeight: 1.5,
};

const heroFooter: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: "0.35rem 0.65rem 0.65rem",
  gap: "0.5rem",
};

const heroHint: CSSProperties = {
  fontSize: "0.62rem",
  color: "var(--text-muted)",
  opacity: 0.7,
  marginRight: "auto",
  padding: "0.15rem 0.45rem",
  borderRadius: 6,
  background: "var(--surface-hover)",
  letterSpacing: "0.01em",
};

const heroBtnBase: CSSProperties = {
  padding: "0.4rem 0.85rem",
  borderRadius: 10,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 600,
  fontSize: "0.78rem",
  cursor: "pointer",
  transition: "opacity 0.15s, transform 0.15s, background 0.15s",
  whiteSpace: "nowrap",
  display: "flex",
  alignItems: "center",
  gap: "0.35rem",
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

  const btnStyle: CSSProperties = isOff
    ? { ...heroBtnBase, opacity: 0.4, cursor: "not-allowed" }
    : heroBtnBase;

  return (
    <div
      style={heroContainer}
      onFocus={(e) => {
        const wrap = e.currentTarget;
        wrap.style.borderColor = "var(--accent)";
        wrap.style.boxShadow = "0 0 0 2px var(--accent-glow), 0 4px 24px rgba(0,0,0,0.08)";
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          const wrap = e.currentTarget;
          wrap.style.borderColor = "var(--glass-border)";
          wrap.style.boxShadow = "0 4px 24px rgba(0,0,0,0.08)";
        }
      }}
    >
      <textarea
        ref={inputRef}
        rows={3}
        style={heroTextarea}
        placeholder="What would you like your AI team to build?"
        disabled={isOff}
        onKeyDown={onKeyDown}
      />
      <div style={heroFooter}>
        <span style={heroHint}>{"\u2318"} Enter</span>
        <button
          style={btnStyle}
          onClick={onSubmit}
          disabled={isOff}
          onMouseEnter={(e) => {
            if (!isOff) e.currentTarget.style.opacity = "0.85";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          {loading ? <SpinnerIcon size={13} /> : <SendIcon />}
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
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
