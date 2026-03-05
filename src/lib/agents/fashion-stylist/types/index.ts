// ──────────────────────────────────────────────────────────
// Fashion Stylist Agent — Type Definitions
// ──────────────────────────────────────────────────────────

export type { FashionContext, ScrapedProduct, OutfitRecommendation, OutfitItem, FashionProgressStage } from "../../types";

/** Progress callback for the fashion stylist pipeline */
export type FashionProgressCallback = (
  stage: import("../../types").FashionProgressStage,
  message: string,
  progress: number,
) => void;
