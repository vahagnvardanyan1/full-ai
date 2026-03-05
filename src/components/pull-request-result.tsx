"use client";

/**
 * Renders create_github_pull_request tool result with PR link always visible.
 */

interface CreatePrResult {
  url?: string;
  prNumber?: number;
  title?: string;
  error?: string;
  simulated?: boolean;
}

export function PullRequestResult({ result }: { result: unknown }) {
  const res = result as CreatePrResult | undefined;
  const url = res?.url?.trim();
  const title = res?.title ?? "Pull request";
  const prNumber = res?.prNumber;
  const simulated = res?.simulated === true;
  const error = res?.error;

  if (error) {
    return (
      <p className="text-[0.75rem] text-[var(--danger)] m-0 mt-1.5">
        {error}
      </p>
    );
  }

  if (!url) {
    return (
      <pre className="mt-1.5 text-[0.75rem] text-[var(--text-muted)] whitespace-pre-wrap">
        {JSON.stringify(res, null, 2)}
      </pre>
    );
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[0.8rem] font-medium text-[var(--accent)] underline break-all hover:opacity-90"
      >
        {simulated ? "[Simulated] " : ""}
        {title}
        {prNumber != null ? ` #${prNumber}` : ""}
      </a>
      <span className="text-[0.7rem] text-[var(--text-muted)] break-all">
        {url}
      </span>
    </div>
  );
}
