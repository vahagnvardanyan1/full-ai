"use client";

import { useRef, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { glassCard } from "@/lib/styles";

function SendIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <path d="M2 8L14 2L8 14L7 9L2 8Z" fill="currentColor" opacity="0.9" />
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
      className="animate-spin"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface ChatInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onTextChange?: (hasText: boolean) => void;
}

export function ChatInput({ onSubmit, disabled, loading, compact, textareaRef, onTextChange }: ChatInputProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? internalRef;

  function handleSubmit() {
    const value = ref.current?.value.trim();
    if (!value || disabled || loading) return;
    onSubmit(value);
    if (ref.current) ref.current.value = "";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter") {
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
      onTextChange={onTextChange}
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

interface InputVariantProps {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean;
  loading?: boolean;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  onTextChange?: (hasText: boolean) => void;
}

function HeroInput({ inputRef, disabled, loading, onKeyDown, onSubmit }: InputVariantProps) {
  const isOff = disabled || loading;

  return (
    <div className={`${glassCard} shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-[border-color,box-shadow] duration-200 overflow-hidden focus-within:border-[#22c55e80] focus-within:shadow-[0_0_0_2px_rgba(34,197,94,0.15),0_4px_24px_rgba(0,0,0,0.08)]`}>
      <textarea
        ref={inputRef}
        rows={3}
        className="w-full min-h-[150px] max-h-[220px] px-5 pt-4 pb-2 border-none bg-transparent text-[var(--text)] text-[1rem] font-[inherit] resize-none outline-none leading-normal placeholder:text-[var(--text-muted)]"
        placeholder="What would you like your AI team to build?"
        disabled={isOff}
        onKeyDown={onKeyDown}
      />
      <div className="flex items-center justify-end px-2.5 pb-2.5 gap-2">
        <span className="text-[0.62rem] text-[var(--text-muted)] opacity-70 mr-auto px-2 py-0.5 rounded-md bg-[var(--surface-hover)] tracking-tight">
          Enter
        </span>
        <button
          className={cn(
            "px-3.5 py-1.5 rounded-[10px] border-none bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-white font-semibold text-[0.78rem] cursor-pointer transition-all whitespace-nowrap flex items-center gap-1.5 shadow-[0_2px_12px_rgba(34,197,94,0.25)] hover:shadow-[0_2px_20px_rgba(34,197,94,0.4)]",
            isOff && "opacity-40 cursor-not-allowed",
          )}
          onClick={onSubmit}
          disabled={isOff}
        >
          {loading ? <SpinnerIcon size={13} /> : <SendIcon />}
          {loading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}

function CompactInput({ inputRef, disabled, loading, onKeyDown, onSubmit, onTextChange }: InputVariantProps) {
  const isOff = disabled || loading;

  return (
    <div className="flex items-center gap-0 border border-[var(--glass-border)] rounded-[14px] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] [-webkit-backdrop-filter:blur(var(--glass-blur))] transition-[border-color,box-shadow] duration-200 overflow-hidden focus-within:border-[#22c55e80] focus-within:shadow-[0_0_0_2px_rgba(34,197,94,0.15)]">
      <textarea
        ref={inputRef}
        rows={1}
        className="flex-1 h-[54px] min-h-[54px] max-h-[54px] px-3 border-none bg-transparent text-[var(--text)] text-[0.92rem] font-[inherit] resize-none outline-none leading-[54px] placeholder:text-[var(--text-muted)]"
        placeholder="Follow-up message..."
        disabled={isOff}
        onKeyDown={onKeyDown}
        onInput={(e) => onTextChange?.((e.target as HTMLTextAreaElement).value.length > 0)}
      />
      <button
        className={cn(
          "flex items-center justify-center gap-1.5 px-3.5 h-[54px] border-none border-l border-l-[var(--glass-border)] bg-transparent text-[#22c55e] text-[0.88rem] font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 hover:bg-[rgba(34,197,94,0.06)]",
          isOff && "opacity-40 cursor-not-allowed",
        )}
        onClick={onSubmit}
        disabled={isOff}
      >
        {loading ? <SpinnerIcon size={15} /> : <SendIcon />}
        {loading ? "Sending" : "Send"}
      </button>
    </div>
  );
}
