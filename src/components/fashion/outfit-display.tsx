"use client";

import { sectionLabel } from "@/lib/styles";
import type { OutfitRecommendation } from "@/lib/agents/types";

interface OutfitDisplayProps {
  outfit: OutfitRecommendation;
}

export function OutfitDisplay({ outfit }: OutfitDisplayProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Generated Image */}
      {(outfit.generatedImageUrl || outfit.generatedImageBase64) && (
        <div className="rounded-xl overflow-hidden border border-[var(--surface-border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={outfit.generatedImageBase64 ? `data:image/png;base64,${outfit.generatedImageBase64}` : outfit.generatedImageUrl}
            alt="Generated outfit visualization"
            className="w-full h-auto max-h-[300px] object-cover"
          />
        </div>
      )}

      {/* Product Cards */}
      <div className={sectionLabel}>
        {outfit.items.length} {outfit.items.length === 1 ? "Item" : "Items"} Selected
      </div>
      <div className="grid grid-cols-1 gap-2">
        {outfit.items.map((item, i) => (
          <a
            key={i}
            href={item.product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-2.5 p-2.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--surface-border)] no-underline hover:border-[#22c55e40] transition-colors group"
          >
            {/* Product Image */}
            {item.product.imageUrl && (
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-[var(--surface-raised)] shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.product.imageUrl}
                  alt={item.product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1.5">
                <div>
                  <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-[#22c55e]">
                    {item.category}
                  </span>
                  <div className="text-[0.78rem] font-medium text-[var(--text)] leading-tight mt-0.5">
                    {item.product.name}
                  </div>
                  <div className="text-[0.65rem] text-[var(--text-muted)]">
                    {item.product.brand}
                  </div>
                </div>
                <span className="text-[0.78rem] font-semibold text-[var(--text)] whitespace-nowrap">
                  ${item.product.price}
                </span>
              </div>
              <p className="text-[0.68rem] text-[var(--text-muted)] mt-1 leading-snug line-clamp-2">
                {item.explanation}
              </p>
            </div>

            {/* External link icon */}
            <svg
              width={14} height={14} viewBox="0 0 16 16" fill="none"
              className="shrink-0 mt-0.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <path d="M6 3H3v10h10v-3M9 2h5v5M14 2L7 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.15)]">
        <span className="text-[0.75rem] font-medium text-[var(--text)]">Total</span>
        <span className="text-[0.88rem] font-bold text-[#22c55e]">
          ${outfit.totalPrice} {outfit.currency}
        </span>
      </div>

      {/* Rationale */}
      {outfit.explanation && (
        <div>
          <div className={sectionLabel}>Style Rationale</div>
          <p className="text-[0.78rem] text-[var(--text-muted)] leading-relaxed">
            {outfit.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
