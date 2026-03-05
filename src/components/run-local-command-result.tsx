"use client";

/**
 * Renders run_local_command tool result in a terminal-like block (stdout/stderr/error).
 * Used in agent response cards and detail panel so users see local command output like locally.
 */

interface RunLocalCommandResult {
  ok?: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

interface RunLocalCommandResultProps {
  arguments: Record<string, unknown>;
  result: unknown;
  /** Smaller typography for detail panel */
  compact?: boolean;
}

export function RunLocalCommandResult({
  arguments: args,
  result,
  compact = false,
}: RunLocalCommandResultProps) {
  const res = result as RunLocalCommandResult | undefined;
  const ok = res?.ok ?? false;
  const stdout = (res?.stdout ?? "").trim();
  const stderr = (res?.stderr ?? "").trim();
  const error = (res?.error ?? "").trim();
  const cmd = (args?.command as string) ?? "";

  const preClass = compact
    ? "m-0 p-2 bg-[var(--bg)] border border-[var(--border)] rounded text-[0.7rem] leading-normal max-h-[160px] overflow-auto text-[var(--text)] font-mono whitespace-pre-wrap"
    : "m-0 p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded text-[0.75rem] leading-normal max-h-[220px] overflow-auto text-[var(--text)] font-mono whitespace-pre-wrap";

  return (
    <div className="flex flex-col gap-1.5 mt-1.5">
      <div className="text-[0.7rem] text-[var(--text-muted)] font-mono">$ {cmd}</div>
      <div className="flex items-center gap-2">
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[0.65rem] font-semibold ${
            ok ? "text-[var(--success)] bg-[var(--success)]15" : "text-[var(--danger)] bg-[var(--danger)]15"
          }`}
        >
          {ok ? "Success" : "Failed"}
        </span>
      </div>
      {stdout.length > 0 && <pre className={preClass}>{stdout}</pre>}
      {stderr.length > 0 && (
        <pre className={`${preClass} max-h-[100px] text-[var(--warning)]`}>{stderr}</pre>
      )}
      {!ok && error.length > 0 && (
        <p className="text-[0.75rem] text-[var(--danger)] m-0">{error}</p>
      )}
    </div>
  );
}
