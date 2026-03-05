// ──────────────────────────────────────────────────────────
// Fashion Stylist Agent — Main Pipeline
//
// Deterministic multi-stage pipeline:
//   1. Parse & validate preferences
//   2. Scrape products from 3 retailers in parallel
//   3. GPT-4o assembles coherent outfit
//   4. Generate outfit visualization image
//   5. Build structured AgentResponse
// ──────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";
import { FashionScraperService } from "./services/scraper.service";
import { FashionOpenAIService } from "./services/openai.service";
import type { AgentResponse, ToolCall, FashionContext, FashionProgressStage } from "../types";

/** Callback for sub-step progress events */
export type FashionProgressCallback = (
  stage: FashionProgressStage,
  message: string,
  progress: number,
) => void;

/** Callback for granular pipeline detail events */
export type FashionDetailCallback = (
  type: "preferences" | "retailer" | "outfit" | "image",
  data: unknown,
) => void;

// ── Helpers ─────────────────────────────────────────────

function buildSearchQuery(ctx: FashionContext): string {
  const parts: string[] = [];
  if (ctx.style) parts.push(ctx.style);
  if (ctx.occasion) parts.push(ctx.occasion);
  if (ctx.colorPreferences) parts.push(ctx.colorPreferences);
  // Fallback
  if (parts.length === 0) parts.push("outfit");
  return parts.join(" ");
}

function getDefaultContext(): FashionContext {
  return {
    budget: { min: 50, max: 300, currency: "USD" },
    style: "casual",
    occasion: "casual outing",
  };
}

// ── Main Pipeline ───────────────────────────────────────

export async function runFashionStylist(
  userMessage: string,
  onProgress?: FashionProgressCallback,
  fashionContext?: FashionContext,
  onDetail?: FashionDetailCallback,
): Promise<AgentResponse> {
  const emit = onProgress ?? (() => {});
  const emitDetail = onDetail ?? (() => {});
  const toolCalls: ToolCall[] = [];
  const detailParts: string[] = [];

  try {
    // ══════════════════════════════════════════════
    // Stage 1: Parse & Validate Preferences (0-10%)
    // ══════════════════════════════════════════════
    emit("parsing_preferences", "Parsing style preferences...", 5);

    const ctx = fashionContext ?? getDefaultContext();

    // Validate budget
    if (ctx.budget.min < 0) ctx.budget.min = 0;
    if (ctx.budget.max <= ctx.budget.min) ctx.budget.max = ctx.budget.min + 200;
    if (!ctx.budget.currency) ctx.budget.currency = "USD";

    detailParts.push(
      `## Style Preferences\n- **Budget:** ${ctx.budget.min}–${ctx.budget.max} ${ctx.budget.currency}\n- **Style:** ${ctx.style}\n- **Occasion:** ${ctx.occasion}${ctx.gender ? `\n- **Gender:** ${ctx.gender}` : ""}${ctx.bodyType ? `\n- **Body Type:** ${ctx.bodyType}` : ""}${ctx.colorPreferences ? `\n- **Colors:** ${ctx.colorPreferences}` : ""}${ctx.photoUrl ? `\n- **Photo:** Uploaded` : ""}`,
    );

    toolCalls.push({
      tool: "parse_preferences",
      arguments: { style: ctx.style, occasion: ctx.occasion, budget: `${ctx.budget.min}-${ctx.budget.max}` },
      result: { valid: true },
    });

    emitDetail("preferences", {
      style: ctx.style,
      occasion: ctx.occasion,
      budget: ctx.budget,
      gender: ctx.gender,
      bodyType: ctx.bodyType,
      colorPreferences: ctx.colorPreferences,
    });

    emit("parsing_preferences", "Preferences validated", 10);

    // ══════════════════════════════════════════════
    // Stage 2: Scrape Products (10-40%)
    // ══════════════════════════════════════════════
    emit("scraping_products", "Searching Zara, Bershka & Massimo Dutti...", 15);

    const scraper = new FashionScraperService();
    const query = buildSearchQuery(ctx);
    const products = await scraper.scrapeAll(query, ctx.gender, (brand, items) => {
      // Emit per-retailer detail with top 8 products (light payload)
      emitDetail("retailer", {
        brand,
        products: items.slice(0, 8).map((p) => ({
          name: p.name,
          brand: p.brand,
          price: p.price,
          currency: p.currency,
          imageUrl: p.imageUrl,
          url: p.url,
          category: p.category,
        })),
        totalCount: items.length,
      });
    });

    emit("scraping_products", `Found ${products.length} products`, 40);

    detailParts.push(`## Products Scraped\n- **Query:** "${query}"\n- **Total found:** ${products.length}\n- **Zara:** ${products.filter(p => p.brand === "Zara").length}\n- **Bershka:** ${products.filter(p => p.brand === "Bershka").length}\n- **Massimo Dutti:** ${products.filter(p => p.brand === "Massimo Dutti").length}`);

    toolCalls.push({
      tool: "scrape_products",
      arguments: { query, retailers: ["Zara", "Bershka", "Massimo Dutti"] },
      result: { totalProducts: products.length },
    });

    if (products.length === 0) {
      // No products found — generate a text-only recommendation
      emit("assembling_outfit", "No products scraped — generating style advice...", 50);

      const summary = `Could not find live products from retailers at this time. Here's what I'd recommend for a **${ctx.style}** look for **${ctx.occasion}** within ${ctx.budget.min}–${ctx.budget.max} ${ctx.budget.currency}:\n\nTry browsing Zara, Bershka, or Massimo Dutti for ${ctx.style} pieces. Look for coordinated neutrals or ${ctx.colorPreferences ?? "complementary tones"}.`;

      emit("complete", "Style advice generated", 100);

      return {
        agent: "fashion_stylist",
        summary,
        toolCalls,
        detail: detailParts.join("\n\n"),
      };
    }

    // Filter products within budget
    const affordableProducts = products.filter(
      (p) => p.price >= 0 && p.price <= ctx.budget.max * 0.6,
    );
    const productPool = affordableProducts.length >= 5 ? affordableProducts : products;

    // ══════════════════════════════════════════════
    // Stage 3: Assemble Outfit via GPT-4o (40-70%)
    // ══════════════════════════════════════════════
    emit("assembling_outfit", "AI is curating your outfit...", 45);

    const openaiService = new FashionOpenAIService();
    const outfit = await openaiService.assembleOutfit(productPool, ctx);

    emitDetail("outfit", {
      items: outfit.items,
      totalPrice: outfit.totalPrice,
      currency: outfit.currency,
      explanation: outfit.explanation,
    });

    emit("assembling_outfit", `Selected ${outfit.items.length} items — $${outfit.totalPrice}`, 70);

    detailParts.push(
      `## Outfit Recommendation\n${outfit.items.map((item) => `- **${item.category}:** ${item.product.name} (${item.product.brand}) — $${item.product.price}\n  ${item.explanation}`).join("\n")}\n\n**Total:** $${outfit.totalPrice} ${outfit.currency}\n\n**Rationale:** ${outfit.explanation}`,
    );

    toolCalls.push({
      tool: "assemble_outfit",
      arguments: { productCount: productPool.length },
      result: { items: outfit.items.length, totalPrice: outfit.totalPrice },
    });

    // ══════════════════════════════════════════════
    // Stage 4: Generate Outfit Image (70-90%)
    // ══════════════════════════════════════════════
    emit("generating_image", "Creating outfit visualization...", 75);

    let generatedImageUrl: string | undefined;
    let generatedImageBase64: string | undefined;

    try {
      const imageResult = await openaiService.generateOutfitImage(outfit, ctx.photoUrl);
      generatedImageUrl = imageResult.url;
      generatedImageBase64 = imageResult.base64;

      if (generatedImageUrl || generatedImageBase64) {
        emitDetail("image", {
          url: generatedImageUrl,
          base64: generatedImageBase64,
        });
        emit("generating_image", "Outfit image generated", 90);
        detailParts.push("## Generated Image\nOutfit visualization created successfully.");
        toolCalls.push({
          tool: "generate_image",
          arguments: { model: "dall-e-3" },
          result: { success: true },
        });
      } else {
        emit("generating_image", "Image generation skipped", 90);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Fashion image generation failed: ${msg}`);
      emit("generating_image", "Image generation failed — skipping", 90);
    }

    // ══════════════════════════════════════════════
    // Stage 5: Complete (90-100%)
    // ══════════════════════════════════════════════
    emit("complete", "Fashion styling complete", 100);

    // Build summary
    const summaryLines: string[] = [];
    summaryLines.push("**Your Outfit is Ready**\n");
    summaryLines.push(`**Style:** ${ctx.style} | **Occasion:** ${ctx.occasion}\n`);
    for (const item of outfit.items) {
      summaryLines.push(`- **${item.category}:** ${item.product.name} (${item.product.brand}) — $${item.product.price}`);
    }
    summaryLines.push(`\n**Total:** $${outfit.totalPrice} ${outfit.currency}`);
    summaryLines.push(`\n${outfit.explanation}`);

    return {
      agent: "fashion_stylist",
      summary: summaryLines.join("\n"),
      toolCalls,
      detail: detailParts.join("\n\n"),
      outfitRecommendation: {
        ...outfit,
        generatedImageUrl,
        generatedImageBase64,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Fashion stylist pipeline failed", { error: msg });

    return {
      agent: "fashion_stylist",
      summary: `Fashion Stylist Failed\nError: ${msg}`,
      toolCalls,
      detail: [...detailParts, `## Error\n${msg}`].join("\n\n"),
    };
  }
}
