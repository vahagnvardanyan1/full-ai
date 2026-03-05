"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { AgentOutput } from "@/lib/workflow-replay";

// ── Link extraction ──────────────────────────────────────

interface PipelineLinks {
  prUrl: string | null;
  vercelUrl: string | null;
  vercelInspectorUrl: string | null;
}

export function extractPipelineLinks(outputs: AgentOutput[]): PipelineLinks {
  let prUrl: string | null = null;
  let vercelUrl: string | null = null;
  let vercelInspectorUrl: string | null = null;

  for (const output of outputs) {
    if (output.response.prUrl && !prUrl) {
      prUrl = output.response.prUrl;
    }

    for (const call of output.response.toolCalls) {
      if (call.tool === "trigger_vercel_deployment" && call.result) {
        const r = call.result as { url?: string; inspectorUrl?: string };
        if (r.url && !vercelUrl) vercelUrl = r.url;
        if (r.inspectorUrl && !vercelInspectorUrl) vercelInspectorUrl = r.inspectorUrl;
      }
    }
  }

  return { prUrl, vercelUrl, vercelInspectorUrl };
}

// ── Props ────────────────────────────────────────────────

interface PipelineSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prUrl: string | null;
  vercelUrl: string | null;
  vercelInspectorUrl: string | null;
}

// ── Component ────────────────────────────────────────────

export function PipelineSuccessModal({
  open,
  onOpenChange,
  prUrl,
  vercelUrl,
  vercelInspectorUrl,
}: PipelineSuccessModalProps) {
  const hasLinks = !!(prUrl || vercelUrl);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[16px]"
          style={{ animation: "fade-in 150ms ease" }}
        />
        <Dialog.Content
          className="fixed z-50 inset-0 m-auto w-[92vw] max-w-[420px] h-fit flex flex-col items-center rounded-2xl border overflow-hidden outline-none px-8 py-8"
          style={{
            animation: "success-modal-in 300ms cubic-bezier(0.16, 1, 0.3, 1)",
            backgroundColor: "var(--panel-bg)",
            borderColor: "var(--glass-border)",
            boxShadow:
              "0 24px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 60px rgba(34,197,94,0.08)",
          }}
        >
          {/* Close button */}
          <Dialog.Close className="absolute top-3 right-3 size-7 rounded-lg bg-[var(--surface-raised)] border border-[var(--surface-border)] flex items-center justify-center cursor-pointer text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">
            <svg
              width={12}
              height={12}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </Dialog.Close>

          {/* Animated checkmark */}
          <div
            className="size-16 rounded-full flex items-center justify-center mb-5"
            style={{
              background: "rgba(34, 197, 94, 0.12)",
              border: "1.5px solid rgba(34, 197, 94, 0.4)",
              boxShadow: "0 0 30px rgba(34, 197, 94, 0.2)",
              animation: "success-check-pop 400ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both",
            }}
          >
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none">
              <polyline
                points="6,12 10,16.5 18,7.5"
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                style={{
                  strokeDasharray: 24,
                  strokeDashoffset: 24,
                  animation: "success-check-draw 400ms ease 350ms forwards",
                }}
              />
            </svg>
          </div>

          {/* Title */}
          <Dialog.Title className="text-[1.1rem] font-semibold text-[var(--text)] mb-1">
            Pipeline Complete
          </Dialog.Title>
          <Dialog.Description className="text-[0.78rem] text-[var(--text-muted)] text-center mb-6 leading-relaxed max-w-[300px]">
            {hasLinks
              ? "Your pipeline finished successfully. Check out the results below."
              : "Your pipeline finished successfully."}
          </Dialog.Description>

          {/* CTA buttons */}
          {hasLinks && (
            <div className="flex flex-col gap-2.5 w-full">
              {prUrl && (
                <a
                  href={prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150 no-underline group"
                  style={{
                    backgroundColor: "rgba(139, 92, 246, 0.06)",
                    borderColor: "rgba(139, 92, 246, 0.2)",
                  }}
                >
                  <div
                    className="size-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: "rgba(139, 92, 246, 0.1)",
                      border: "1px solid rgba(139, 92, 246, 0.2)",
                    }}
                  >
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="#8b5cf6">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.82rem] font-medium text-[#8b5cf6]">
                      View Pull Request
                    </div>
                    <div className="text-[0.68rem] text-[var(--text-muted)] truncate">
                      {prUrl}
                    </div>
                  </div>
                  <svg
                    width={14}
                    height={14}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                  >
                    <path d="M7 17L17 7" />
                    <path d="M7 7h10v10" />
                  </svg>
                </a>
              )}

              {vercelUrl && (
                <a
                  href={vercelInspectorUrl || vercelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150 no-underline group"
                  style={{
                    backgroundColor: "rgba(249, 115, 22, 0.06)",
                    borderColor: "rgba(249, 115, 22, 0.2)",
                  }}
                >
                  <div
                    className="size-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: "rgba(249, 115, 22, 0.1)",
                      border: "1px solid rgba(249, 115, 22, 0.2)",
                    }}
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="#f97316">
                      <path d="M12 1L24 22H0L12 1z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.82rem] font-medium text-[#f97316]">
                      View Deployment
                    </div>
                    <div className="text-[0.68rem] text-[var(--text-muted)] truncate">
                      {vercelUrl}
                    </div>
                  </div>
                  <svg
                    width={14}
                    height={14}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                  >
                    <path d="M7 17L17 7" />
                    <path d="M7 7h10v10" />
                  </svg>
                </a>
              )}
            </div>
          )}

          {/* Close button at bottom */}
          <button
            onClick={() => onOpenChange(false)}
            className="mt-5 px-5 py-2 rounded-lg bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[0.78rem] font-medium text-[var(--text-muted)] cursor-pointer transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
          >
            Close
          </button>
        </Dialog.Content>
      </Dialog.Portal>

      {/* Scoped keyframes */}
      <style>{`
        @keyframes success-modal-in {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes success-check-pop {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes success-check-draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </Dialog.Root>
  );
}
