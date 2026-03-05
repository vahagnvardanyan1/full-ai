// ──────────────────────────────────────────────────────────
// Fashion Stylist — OpenAI Service
//
// - assembleOutfit: GPT-4o selects items from scraped products
// - generateOutfitImage: gpt-image-1 creates outfit visualization
// ──────────────────────────────────────────────────────────

import { getOpenAIClient } from "@/lib/clients/openai";
import { toFile } from "openai";
import { logger } from "@/lib/logger";
import { readFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import { FASHION_STYLIST_SYSTEM, OUTFIT_IMAGE_PROMPT_PREFIX } from "../system-prompt";
import type { ScrapedProduct, OutfitRecommendation, OutfitItem, FashionContext } from "@/lib/agents/types";

interface GPTOutfitChoice {
  items: { productIndex: number; category: string; explanation: string }[];
  totalPrice: number;
  currency: string;
  explanation: string;
}

export class FashionOpenAIService {
  /**
   * Ask GPT-4o to select a coherent outfit from the scraped products.
   */
  async assembleOutfit(
    products: ScrapedProduct[],
    preferences: FashionContext,
  ): Promise<OutfitRecommendation> {
    const openai = getOpenAIClient();

    const productCatalog = products.map((p, i) => ({
      index: i,
      name: p.name,
      brand: p.brand,
      price: p.price,
      currency: p.currency,
      category: p.category,
      color: p.color,
      description: p.description,
      url: p.url,
      imageUrl: p.imageUrl,
    }));

    const userPrompt = `## User Preferences
- Budget: ${preferences.budget.min}–${preferences.budget.max} ${preferences.budget.currency}
- Style: ${preferences.style}
- Occasion: ${preferences.occasion}
${preferences.gender ? `- Gender: ${preferences.gender}` : ""}
${preferences.bodyType ? `- Body Type: ${preferences.bodyType}` : ""}
${preferences.colorPreferences ? `- Color Preferences: ${preferences.colorPreferences}` : ""}

## Available Products (${products.length} items)
${JSON.stringify(productCatalog, null, 2)}

Select a complete outfit from the products above. Stay within budget.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: FASHION_STYLIST_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("GPT-4o returned empty response for outfit assembly");

    const parsed = JSON.parse(raw) as GPTOutfitChoice;

    // Map GPT choices back to actual products
    const items: OutfitItem[] = parsed.items
      .filter((c) => c.productIndex >= 0 && c.productIndex < products.length)
      .map((c) => ({
        product: products[c.productIndex],
        category: c.category,
        explanation: c.explanation,
      }));

    // Recalculate total to be accurate
    const totalPrice = items.reduce((sum, item) => sum + item.product.price, 0);

    return {
      items,
      totalPrice: Math.round(totalPrice * 100) / 100,
      currency: preferences.budget.currency,
      explanation: parsed.explanation,
    };
  }

  /**
   * Generate an outfit visualization image.
   * If a user photo is provided, uses gpt-image-1 to edit the image
   * showing the person wearing the recommended outfit.
   * Otherwise falls back to dall-e-3 for a generic visualization.
   */
  async generateOutfitImage(
    outfit: OutfitRecommendation,
    userPhotoUrl?: string,
  ): Promise<{ base64?: string; url?: string }> {
    const openai = getOpenAIClient();

    const itemDescriptions = outfit.items
      .map((item) => `${item.category}: ${item.product.name} by ${item.product.brand} (${item.product.color || "neutral"})`)
      .join(", ");

    try {
      // If user uploaded a photo, use gpt-image-1 to edit it with the outfit
      if (userPhotoUrl) {
        return await this.generateWithUserPhoto(openai, outfit, itemDescriptions, userPhotoUrl);
      }

      // No photo — generate a standalone outfit image with dall-e-3
      const prompt = `${OUTFIT_IMAGE_PROMPT_PREFIX} ${itemDescriptions}. The outfit should look cohesive and stylish. ${outfit.explanation}`;

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt.slice(0, 4000),
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });

      const imageUrl = response.data?.[0]?.url;
      return { url: imageUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : "";
      logger.error(`Outfit image generation failed: ${msg}`, { stack });
      return {};
    }
  }

  /**
   * Virtual try-on using openai.images.edit() with gpt-image-1.
   * Sends the user's photo + product images so the AI can see the
   * actual clothes and render them on the person.
   */
  private async generateWithUserPhoto(
    openai: ReturnType<typeof getOpenAIClient>,
    outfit: OutfitRecommendation,
    itemDescriptions: string,
    photoUrl: string,
  ): Promise<{ base64?: string; url?: string }> {
    // Read the uploaded photo — supports data URLs and /tmp paths
    let photoBuffer: Buffer;
    if (photoUrl.startsWith("data:")) {
      const base64Data = photoUrl.split(",")[1];
      photoBuffer = Buffer.from(base64Data, "base64");
      logger.info("Try-on: decoded user photo from base64 data URL");
    } else {
      // Try /tmp first (serverless), then public/ (local dev)
      const tmpPath = join("/tmp", "uploads", "photos", photoUrl.split("/").pop() ?? "");
      const publicPath = join(process.cwd(), "public", photoUrl);
      let resolvedPath = publicPath;
      try {
        await readFile(tmpPath);
        resolvedPath = tmpPath;
      } catch {
        // fall back to public path
      }
      logger.info(`Try-on: reading user photo from ${resolvedPath}`);
      photoBuffer = await readFile(resolvedPath);
    }

    // Detect image dimensions to pick the best output size
    const metadata = await sharp(photoBuffer).metadata();
    const imgW = metadata.width ?? 1;
    const imgH = metadata.height ?? 1;
    const ratio = imgW / imgH;
    // gpt-image-1 supports: 1024x1024, 1024x1536 (portrait), 1536x1024 (landscape)
    const imageSize: "1024x1024" | "1024x1536" | "1536x1024" =
      ratio < 0.8 ? "1024x1536" : ratio > 1.25 ? "1536x1024" : "1024x1024";
    logger.info(`Try-on: detected image ${imgW}x${imgH} (ratio ${ratio.toFixed(2)}), using size ${imageSize}`);

    // Fetch product images to send as references
    const productImageBuffers = await this.fetchProductImageBuffers(outfit);
    logger.info(`Try-on: fetched ${productImageBuffers.length} product images`);

    // Convert all images to File objects for the Images API
    const userFile = await toFile(photoBuffer, "user-photo.jpg", { type: "image/jpeg" });
    const productFiles = await Promise.all(
      productImageBuffers.map((img, i) =>
        toFile(img.buffer, `product-${i}.jpg`, { type: "image/jpeg" }),
      ),
    );

    // Build the prompt
    const productLabels = productImageBuffers
      .map((p, i) => `Image ${i + 2}: "${p.name}" (${p.category}) by ${p.brand}`)
      .join("\n");

    const prompt = [
      "VIRTUAL TRY-ON: The first image is a photo of a person. The following images are clothing items.",
      "",
      productLabels,
      "",
      "Generate a new image showing the SAME person from the first photo wearing these exact clothing items.",
      "Keep the person's face, hair, body proportions, pose, and background exactly the same.",
      "Replace their current clothes with the clothing items shown in the product images.",
      "Make the clothes fit naturally on the person's body with realistic lighting.",
    ].join("\n");

    // Call images.edit with gpt-image-1 (supports multiple images)
    const images = [userFile, ...productFiles];
    logger.info(`Try-on: calling gpt-image-1 images.edit with ${images.length} images`);

    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: images,
      prompt: prompt.slice(0, 4000),
      size: imageSize,
    });

    const resultUrl = response.data?.[0]?.url;
    const resultB64 = response.data?.[0]?.b64_json;

    if (resultB64) {
      logger.info("Try-on: successfully generated try-on image (base64)");
      return { base64: resultB64 };
    }
    if (resultUrl) {
      logger.info("Try-on: successfully generated try-on image (url)");
      return { url: resultUrl };
    }

    logger.warn("gpt-image-1 images.edit did not return an image, falling back to dall-e-3");
    const fallbackPrompt = `${OUTFIT_IMAGE_PROMPT_PREFIX} ${itemDescriptions}. The outfit should look cohesive and stylish.`;
    const fallbackResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: fallbackPrompt.slice(0, 4000),
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });
    return { url: fallbackResponse.data?.[0]?.url };
  }

  /**
   * Fetch product images from their URLs and return as Buffers.
   */
  private async fetchProductImageBuffers(
    outfit: OutfitRecommendation,
  ): Promise<Array<{ buffer: Buffer; name: string; category: string; brand: string }>> {
    const results: Array<{ buffer: Buffer; name: string; category: string; brand: string }> = [];

    const fetches = outfit.items.map(async (item) => {
      if (!item.product.imageUrl) return null;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(item.product.imageUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            Accept: "image/*",
          },
        });
        clearTimeout(timeout);
        if (!res.ok) return null;
        return {
          buffer: Buffer.from(await res.arrayBuffer()),
          name: item.product.name,
          category: item.category,
          brand: item.product.brand,
        };
      } catch {
        logger.warn(`Failed to fetch product image: ${item.product.imageUrl}`);
        return null;
      }
    });

    const settled = await Promise.allSettled(fetches);
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) {
        results.push(r.value);
      }
    }
    return results;
  }
}
