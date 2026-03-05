// ──────────────────────────────────────────────────────────
// Fashion Scraper Service
//
// Fetches products from Zara, Bershka, Massimo Dutti via
// their internal itxrest JSON APIs. Runs all scrapers in
// parallel with graceful degradation via Promise.allSettled.
// ──────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";
import type { ScrapedProduct } from "@/lib/agents/types";

// ── In-memory cache (1h TTL) ─────────────────────────────

interface CacheEntry {
  products: ScrapedProduct[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCacheKey(brand: string, query: string, gender: string): string {
  return `${brand}:${query}:${gender}`;
}

function getCached(key: string): ScrapedProduct[] | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.products;
  if (entry) cache.delete(key);
  return null;
}

function setCache(key: string, products: ScrapedProduct[]): void {
  cache.set(key, { products, timestamp: Date.now() });
}

// ── Common fetch helper ──────────────────────────────────

function getHeaders(brand: string): Record<string, string> {
  const base = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
  };

  switch (brand) {
    case "zara":
      return { ...base, Origin: "https://www.zara.com", Referer: "https://www.zara.com/" };
    case "bershka":
      return { ...base, Origin: "https://www.bershka.com", Referer: "https://www.bershka.com/" };
    case "massimodutti":
      return { ...base, Origin: "https://www.massimodutti.com", Referer: "https://www.massimodutti.com/" };
    default:
      return base;
  }
}

async function fetchJSON<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: headers ?? getHeaders(""),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Category inference ───────────────────────────────────

function inferCategory(name: string): ScrapedProduct["category"] {
  const text = name.toLowerCase();
  if (/dress|jumpsuit/.test(text)) return "dress";
  if (/jacket|coat|blazer|parka|vest|gilet|cardigan/.test(text)) return "outerwear";
  if (/shoe|sneaker|boot|sandal|loafer|heel|mule|trainer/.test(text)) return "shoes";
  if (/trouser|pant|jean|short|skirt|legging/.test(text)) return "bottom";
  if (/bag|belt|scarf|hat|watch|sunglasses|necklace|earring|bracelet|ring/.test(text)) return "accessory";
  return "top";
}

// ── Zara ─────────────────────────────────────────────────
// Single-step: search returns full product data

interface ZaraSearchResponse {
  status: string;
  results?: Array<{
    content: {
      name?: string;
      price?: number;
      seo?: { keyword?: string; seoProductId?: string };
      xmedia?: Array<{ url?: string }>;
      detail?: { colors?: Array<{ name?: string }> };
      availability?: string;
    };
  }>;
}

async function scrapeZara(query: string, gender: string): Promise<ScrapedProduct[]> {
  const cacheKey = getCacheKey("zara", query, gender);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const section = gender === "woman" ? "WOMAN" : "MAN";
  const url =
    `https://www.zara.com/itxrest/1/search/store/11719/query` +
    `?query=${encodeURIComponent(query)}&locale=en_US&deviceType=desktop` +
    `&catalogue=21053&warehouse=15053&section=${section}` +
    `&offset=0&limit=20&scope=default&origin=search&ajax=true`;

  try {
    const data = await fetchJSON<ZaraSearchResponse>(url, getHeaders("zara"));
    const products: ScrapedProduct[] = [];

    for (const r of data.results ?? []) {
      const c = r.content;
      if (!c.name || c.price == null) continue;

      const seo = c.seo ?? {};
      const imgRaw = c.xmedia?.[0]?.url ?? "";
      const imageUrl = imgRaw ? imgRaw.replace("{width}", "563") : "";
      const colorName = c.detail?.colors?.[0]?.name ?? "";

      products.push({
        name: c.name,
        brand: "Zara",
        price: c.price / 100, // cents → dollars
        currency: "USD",
        url: seo.keyword && seo.seoProductId
          ? `https://www.zara.com/us/en/${seo.keyword}-p${seo.seoProductId}.html`
          : "https://www.zara.com",
        imageUrl,
        category: inferCategory(c.name),
        color: colorName,
        description: c.name,
      });
    }

    setCache(cacheKey, products);
    logger.info(`Zara API: found ${products.length} products`);
    return products;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Zara API failed for query="${query}" gender="${gender}": ${msg}`);
    return [];
  }
}

// ── Bershka ──────────────────────────────────────────────
// Two-step: search → product IDs → productsArray for details

interface ItxSearchResponse {
  results?: Array<{ id: string }>;
}

interface ItxProductResponse {
  products?: Array<{
    id: number;
    name?: string;
    nameEn?: string;
    bundleProductSummaries?: Array<{
      detail?: {
        reference?: string;
        displayReference?: string;
        colors?: Array<{
          name?: string;
          image?: { url?: string; timestamp?: string };
          sizes?: Array<{ price?: string; isBuyable?: boolean }>;
        }>;
      };
    }>;
  }>;
}

async function scrapeBershka(query: string, _gender: string): Promise<ScrapedProduct[]> {
  const cacheKey = getCacheKey("bershka", query, _gender);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Step 1: search for product IDs
    const searchUrl =
      `https://www.bershka.com/itxrest/1/search/store/45009578/query` +
      `?query=${encodeURIComponent(query)}&locale=en_US&offset=0&limit=20&ajax=true`;

    const bershkaHeaders = getHeaders("bershka");
    const searchData = await fetchJSON<ItxSearchResponse>(searchUrl, bershkaHeaders);
    const ids = (searchData.results ?? []).map((r) => r.id).slice(0, 20);
    if (ids.length === 0) return [];

    // Step 2: fetch product details
    const detailUrl =
      `https://www.bershka.com/itxrest/3/catalog/store/45009578/40259549/productsArray` +
      `?languageId=-15&appId=1&productIds=${ids.join(",")}`;

    const detailData = await fetchJSON<ItxProductResponse>(detailUrl, bershkaHeaders);
    const products: ScrapedProduct[] = [];

    for (const p of detailData.products ?? []) {
      const name = p.name || p.nameEn;
      if (!name) continue;

      const bundle = p.bundleProductSummaries?.[0];
      const colors = bundle?.detail?.colors ?? [];
      const firstColor = colors[0];
      const price = firstColor?.sizes?.find((s) => s.isBuyable)?.price ?? firstColor?.sizes?.[0]?.price;
      if (!price) continue;

      const imgPath = firstColor?.image?.url ?? "";
      const imgTs = firstColor?.image?.timestamp ?? "";
      const imageUrl = imgPath
        ? `https://static.bershka.net/4/photos2${imgPath}_2_1_0.jpg${imgTs ? `?t=${imgTs}` : ""}`
        : "";

      products.push({
        name,
        brand: "Bershka",
        price: parseInt(price, 10) / 100,
        currency: "USD",
        url: `https://www.bershka.com/us/product.html?productId=${p.id}`,
        imageUrl,
        category: inferCategory(name),
        color: firstColor?.name ?? "",
        description: name,
      });
    }

    setCache(cacheKey, products);
    logger.info(`Bershka API: found ${products.length} products`);
    return products;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Bershka API failed for query="${query}": ${msg}`);
    return [];
  }
}

// ── Massimo Dutti ────────────────────────────────────────
// Two-step: same pattern as Bershka

async function scrapeMassimoDutti(query: string, _gender: string): Promise<ScrapedProduct[]> {
  const cacheKey = getCacheKey("massimodutti", query, _gender);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Step 1: search for product IDs
    const searchUrl =
      `https://www.massimodutti.com/itxrest/1/search/store/34009527/query` +
      `?query=${encodeURIComponent(query)}&locale=en&offset=0&limit=20&appId=1&languageId=-1`;

    const mdHeaders = getHeaders("massimodutti");
    const searchData = await fetchJSON<ItxSearchResponse>(searchUrl, mdHeaders);
    const ids = (searchData.results ?? []).map((r) => r.id).slice(0, 20);
    if (ids.length === 0) return [];

    // Step 2: fetch product details
    const detailUrl =
      `https://www.massimodutti.com/itxrest/3/catalog/store/34009527/30359506/productsArray` +
      `?languageId=-1&appId=1&productIds=${ids.join(",")}`;

    const detailData = await fetchJSON<ItxProductResponse>(detailUrl, mdHeaders);
    const products: ScrapedProduct[] = [];

    for (const p of detailData.products ?? []) {
      const name = p.name || p.nameEn;
      if (!name) continue;

      // Massimo Dutti may have bundleProductSummaries or direct detail
      const bundle = p.bundleProductSummaries?.[0];
      const colors = bundle?.detail?.colors ?? [];
      const firstColor = colors[0];
      const price = firstColor?.sizes?.find((s) => s.isBuyable)?.price ?? firstColor?.sizes?.[0]?.price;
      if (!price) continue;

      const imgPath = firstColor?.image?.url ?? "";
      const imgTs = firstColor?.image?.timestamp ?? "";
      const imageUrl = imgPath
        ? `https://static.massimodutti.net/3/photos${imgPath}_2_1_0.jpg${imgTs ? `?t=${imgTs}` : ""}`
        : "";

      products.push({
        name,
        brand: "Massimo Dutti",
        price: parseInt(price, 10) / 100,
        currency: "USD",
        url: `https://www.massimodutti.com/us/product.html?productId=${p.id}`,
        imageUrl,
        category: inferCategory(name),
        color: firstColor?.name ?? "",
        description: name,
      });
    }

    setCache(cacheKey, products);
    logger.info(`Massimo Dutti API: found ${products.length} products`);
    return products;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Massimo Dutti API failed for query="${query}": ${msg}`);
    return [];
  }
}

// ── Public API ───────────────────────────────────────────

export class FashionScraperService {
  async scrapeAll(
    query: string,
    gender: string = "unisex",
    onResult?: (brand: string, products: ScrapedProduct[]) => void,
  ): Promise<ScrapedProduct[]> {
    const genderNorm =
      gender.toLowerCase().includes("woman") || gender.toLowerCase().includes("female")
        ? "woman"
        : "man";

    const brandScrapers: [string, Promise<ScrapedProduct[]>][] = [
      ["Zara", scrapeZara(query, genderNorm)],
      ["Bershka", scrapeBershka(query, genderNorm)],
      ["Massimo Dutti", scrapeMassimoDutti(query, genderNorm)],
    ];

    const products: ScrapedProduct[] = [];

    const results = await Promise.allSettled(
      brandScrapers.map(async ([brand, promise]) => {
        const items = await promise;
        if (onResult) onResult(brand, items);
        return items;
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        products.push(...result.value);
      }
    }

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.length > 0,
    ).length;
    const rejectedCount = results.filter((r) => r.status === "rejected").length;
    logger.info(`Fashion scraper total: ${products.length} products from ${successCount}/3 retailers (${rejectedCount} rejected)`);

    if (products.length === 0) {
      logger.error("All scrapers returned 0 products — APIs may be blocking serverless IPs");
      for (const [i, result] of results.entries()) {
        const brand = brandScrapers[i][0];
        if (result.status === "rejected") {
          logger.error(`  ${brand}: REJECTED — ${result.reason}`);
        } else {
          logger.error(`  ${brand}: fulfilled with ${result.value.length} products`);
        }
      }
    }

    return products;
  }
}
