"use client";

import { useState, useCallback } from "react";

import {
  FashionFlowPreview,
  type FashionFlowProps,
} from "./fashion-pipeline-flow";
import { FashionUnifiedFlow } from "./fashion-unified-flow";
import { FashionHistoryPanel } from "./fashion-history-panel";
import { useAgentHistory } from "@/hooks/use-agent-history";
import type { IAgentRunDocument } from "@/lib/db/models/agent-run";
import type {
  FashionContext,
  AgentResponse,
  FashionProgressStage,
  ScrapedProduct,
  OutfitItem,
} from "@/lib/agents/types";

// ── Types ─────────────────────────────────────────────────

type Stage = {
  stage: FashionProgressStage;
  message: string;
  progress: number;
};

type ViewState = "idle" | "form" | "running" | "done";

// ── Component ─────────────────────────────────────────────

export function FashionAgentInteraction() {
  const [view, setView] = useState<ViewState>("idle");
  const [showHistory, setShowHistory] = useState(false);
  const [currentStage, setCurrentStage] = useState<Stage | null>(null);
  const [result, setResult] = useState<AgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Pipeline flow state
  const [preferences, setPreferences] = useState<
    FashionFlowProps["preferences"] | undefined
  >();
  const [retailers, setRetailers] = useState<FashionFlowProps["retailers"]>(
    new Map(),
  );
  const [outfit, setOutfit] = useState<
    FashionFlowProps["outfit"] | undefined
  >();
  const [generatedImage, setGeneratedImage] = useState<
    FashionFlowProps["image"] | undefined
  >();

  const { runs, isLoading: isHistoryLoading, refresh: refreshHistory } =
    useAgentHistory({ agentType: "fashion_stylist" });

  const resetFlow = useCallback(() => {
    setPreferences(undefined);
    setRetailers(new Map());
    setOutfit(undefined);
    setGeneratedImage(undefined);
    setCurrentStage(null);
    setResult(null);
    setError(null);
  }, []);

  // Pre-fills the form with a past run's input so the user can re-run the same style
  const handleRerunFromHistory = useCallback(
    (_run: IAgentRunDocument) => {
      setShowHistory(false);
      setView("form");
    },
    [],
  );

  const handleSubmit = useCallback(
    async (context: FashionContext, message: string) => {
      setView("running");
      setShowHistory(false);
      setError(null);
      setResult(null);
      setCurrentStage(null);
      resetFlow();

      try {
        const res = await fetch("/api/fashion-stylist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fashionContext: context, message }),
        });

        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lastDoubleNewline = buffer.lastIndexOf("\n\n");
          if (lastDoubleNewline === -1) continue;

          const complete = buffer.slice(0, lastDoubleNewline + 2);
          buffer = buffer.slice(lastDoubleNewline + 2);

          for (const block of complete.split("\n\n")) {
            const eventLine = block
              .split("\n")
              .find((l) => l.startsWith("event: "));
            const dataLine = block
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!eventLine || !dataLine) continue;

            const eventType = eventLine.slice(7);
            try {
              const data = JSON.parse(dataLine.slice(6));

              if (eventType === "progress") {
                setCurrentStage(data as Stage);
              } else if (eventType === "detail") {
                const { type, data: detailData } = data;
                if (type === "preferences") {
                  setPreferences(detailData);
                } else if (type === "retailer") {
                  setRetailers((prev) => {
                    const next = new Map(prev);
                    next.set(detailData.brand, {
                      brand: detailData.brand,
                      products: detailData.products as Pick<
                        ScrapedProduct,
                        | "name"
                        | "brand"
                        | "price"
                        | "currency"
                        | "imageUrl"
                        | "url"
                        | "category"
                      >[],
                      totalCount:
                        detailData.totalCount ?? detailData.products.length,
                      status: "done" as const,
                    });
                    return next;
                  });
                } else if (type === "outfit") {
                  setOutfit(
                    detailData as {
                      items: OutfitItem[];
                      totalPrice: number;
                      currency: string;
                      explanation: string;
                    },
                  );
                } else if (type === "image") {
                  setGeneratedImage(
                    detailData as { url?: string; base64?: string },
                  );
                }
              } else if (eventType === "complete") {
                setResult(data.response as AgentResponse);
                setView("done");
                refreshHistory();
              } else if (eventType === "error") {
                setError(data.message);
              }
            } catch {
              /* skip invalid JSON */
            }
          }
        }

        // Flush remaining
        buffer += decoder.decode();
        if (buffer.trim()) {
          for (const block of buffer.split("\n\n")) {
            const dataLine = block
              .split("\n")
              .find((l) => l.startsWith("data: "));
            const eventLine = block
              .split("\n")
              .find((l) => l.startsWith("event: "));
            if (!eventLine || !dataLine) continue;
            const eventType = eventLine.slice(7);
            try {
              const data = JSON.parse(dataLine.slice(6));
              if (eventType === "complete") {
                setResult(data.response as AgentResponse);
                setView("done");
                refreshHistory();
              }
              if (eventType === "error") setError(data.message);
            } catch {
              /* skip */
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!result) setView("done");
      }
    },
    [resetFlow, result, refreshHistory],
  );

  const showUnifiedFlow = view === "form" || view === "running" || view === "done";

  const HistoryToggleButton = (
    <button
      onClick={() => setShowHistory((v) => !v)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.7rem] font-medium cursor-pointer transition-all"
      style={{
        background: showHistory
          ? "rgba(236,72,153,0.12)"
          : "rgba(255,255,255,0.04)",
        border: `1px solid ${showHistory ? "rgba(236,72,153,0.35)" : "rgba(255,255,255,0.1)"}`,
        color: showHistory ? "#ec4899" : "var(--text-muted)",
      }}
    >
      <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" />
        <polyline points="8,4.5 8,8 10.2,9.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      History
      {runs.length > 0 && (
        <span
          className="text-[0.58rem] font-bold px-1 py-px rounded-full min-w-[16px] text-center"
          style={{
            background: showHistory ? "rgba(236,72,153,0.2)" : "rgba(255,255,255,0.08)",
            color: showHistory ? "#ec4899" : "var(--text-muted)",
          }}
        >
          {runs.length}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Idle: onboarding with live flow preview */}
      {view === "idle" && (
        <div
          className="relative rounded-[var(--radius-lg)] border border-[var(--glass-border)] overflow-hidden flex-1 min-h-0 bg-[var(--flow-bg)]"
          style={{ animation: "slide-in 0.4s ease-out" }}
        >
          {/* Live animated flow background */}
          <div className="absolute inset-0">
            <FashionFlowPreview />
          </div>
          {/* Compact center vignette */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 40% 45% at center, var(--flow-bg) 0%, rgba(0,0,0,0) 100%)",
            }}
          />
          {/* History toggle — top-right corner */}
          <div className="absolute top-3 right-3 z-10">
            {HistoryToggleButton}
          </div>
          {/* CTA content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
            <div className="text-[2rem] sm:text-[2.5rem] mb-2 sm:mb-3">✦</div>
            <h2 className="text-[1.1rem] sm:text-[1.3rem] font-bold text-[var(--text)] mb-1.5 sm:mb-2">
              Ready to find your look?
            </h2>
            <p className="text-[0.78rem] sm:text-[0.85rem] text-[var(--text-muted)] mb-5 sm:mb-8 max-w-[420px] leading-relaxed">
              Tell us your style, occasion, and budget — our AI will search real
              products from top retailers and curate a complete outfit for you.
            </p>
            <button
              onClick={() => setView("form")}
              className="pointer-events-auto px-7 sm:px-10 py-3 sm:py-3.5 rounded-2xl border-none font-semibold text-white text-[0.85rem] sm:text-[0.9rem] cursor-pointer transition-all shadow-[0_4px_24px_rgba(34,197,94,0.3)] hover:shadow-[0_4px_32px_rgba(34,197,94,0.5)] hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
              }}
            >
              Start Styling
            </button>
          </div>

          {/* History panel overlay */}
          {showHistory && (
            <FashionHistoryPanel
              runs={runs}
              isLoading={isHistoryLoading}
              onSelectRun={handleRerunFromHistory}
              onClose={() => setShowHistory(false)}
            />
          )}
        </div>
      )}

      {/* Unified flow: form steps + pipeline in one ReactFlow */}
      {showUnifiedFlow && (
        <div
          className="relative flex-1 min-h-0 flex flex-col"
          style={{ animation: "slide-in 0.3s ease-out" }}
        >
          <div className="flex-1 min-h-0">
            <FashionUnifiedFlow
              phase={view as "form" | "running" | "done"}
              onSubmit={handleSubmit}
              onClose={() => setView("idle")}
              preferences={preferences}
              retailers={retailers}
              outfit={outfit}
              image={generatedImage}
              currentStage={currentStage?.stage ?? "parsing_preferences"}
            />
          </div>

          {/* History panel overlay on done view */}
          {showHistory && view === "done" && (
            <FashionHistoryPanel
              runs={runs}
              isLoading={isHistoryLoading}
              onSelectRun={handleRerunFromHistory}
              onClose={() => setShowHistory(false)}
            />
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.15)]">
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            className="shrink-0"
          >
            <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.8" />
            <line
              x1="12"
              y1="8"
              x2="12"
              y2="13"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="16.5" r="1.2" fill="#ef4444" />
          </svg>
          <div className="flex-1 min-w-0">
            <span className="text-[0.82rem] font-medium text-[var(--error)]">
              Something went wrong
            </span>
            <p className="text-[0.72rem] text-[var(--text-muted)] mt-0.5">
              {error}
            </p>
          </div>
          <button
            onClick={() => {
              resetFlow();
              setView("form");
            }}
            className="px-3 py-1.5 rounded-lg border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.06)] text-[#22c55e] text-[0.72rem] font-medium cursor-pointer transition-all hover:bg-[rgba(34,197,94,0.12)] shrink-0"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Style Me Again + History (after completion) */}
      {view === "done" && result && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              resetFlow();
              setView("form");
            }}
            className="flex-1 py-3 rounded-2xl border border-[rgba(34,197,94,0.2)] bg-[rgba(34,197,94,0.04)] text-[#22c55e] text-[0.85rem] font-semibold cursor-pointer transition-all hover:bg-[rgba(34,197,94,0.1)] hover:border-[rgba(34,197,94,0.35)]"
          >
            Style Me Again
          </button>
          {HistoryToggleButton}
        </div>
      )}
    </div>
  );
}
