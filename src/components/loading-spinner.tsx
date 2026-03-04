"use client";

export function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <div className="size-10 rounded-full border-3 border-[var(--border)] border-t-[var(--accent)] animate-spin" />
      {message && <p className="text-[var(--text-muted)] text-sm">{message}</p>}
    </div>
  );
}
