"use client";

import { useMemo, useState, useEffect, useCallback, CSSProperties } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import type { ScrapedProduct, OutfitItem } from "@/lib/agents/types";

// ── Types ──────────────────────────────────────────────

export interface FashionFlowProps {
  preferences?: {
    style: string;
    occasion: string;
    budget: { min: number; max: number; currency: string };
    gender?: string;
    bodyType?: string;
    colorPreferences?: string;
  };
  retailers: Map<
    string,
    {
      brand: string;
      products: Pick<ScrapedProduct, "name" | "brand" | "price" | "currency" | "imageUrl" | "url" | "category">[];
      totalCount: number;
      status: "loading" | "done" | "error";
    }
  >;
  outfit?: {
    items: OutfitItem[];
    totalPrice: number;
    currency: string;
    explanation: string;
  };
  image?: { url?: string; base64?: string };
  photoUrl?: string;
  currentStage: string;
}

// ── Responsive hook ────────────────────────────────────

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < breakpoint); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

// ── Constants ──────────────────────────────────────────

const ACCENT = "#22c55e";
const NODE_WIDTH = 280;
const NODE_WIDTH_MOBILE = 220;
const X_GAP = 340;
const X_GAP_MOBILE = 260;
const Y_GAP = 180;
const Y_GAP_MOBILE = 140;
const ALL_BRANDS = ["Zara", "Bershka", "Massimo Dutti"];

// ── Shared node card style ─────────────────────────────

function cardStyle(opts: {
  status: "pending" | "working" | "done" | "error";
  width?: number;
}): CSSProperties {
  const { status, width = NODE_WIDTH } = opts;
  return {
    background: "var(--glass-bg)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border:
      status === "error"
        ? "1.5px solid var(--error)"
        : status === "working"
          ? `1.5px solid ${ACCENT}`
          : status === "done"
            ? `1px solid ${ACCENT}60`
            : "1px dashed var(--idle-border, rgba(255,255,255,0.12))",
    borderRadius: 14,
    padding: "12px 14px",
    width,
    opacity: status === "pending" ? 0.45 : 1,
    transition: "all 0.4s ease, opacity 0.4s ease",
    animation: status === "working" ? "glow-pulse 2s ease-in-out infinite" : undefined,
    // @ts-expect-error CSS custom property
    "--glow-color": `${ACCENT}40`,
    boxShadow: "var(--node-shadow, 0 2px 8px rgba(0,0,0,0.15))",
  };
}

function handleStyle(position: "left" | "right"): CSSProperties {
  return {
    background: ACCENT,
    width: 8,
    height: 8,
    border: "2px solid var(--bg, #111)",
    [position === "left" ? "left" : "right"]: -4,
  };
}

function StatusDots() {
  return (
    <div className="flex items-center gap-1 mt-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1 rounded-full inline-block"
          style={{
            background: ACCENT,
            animation: `dot-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── Node Icons ────────────────────────────────────────

function PreferencesIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

function OutfitIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.38 3.46L16 2 12 5 8 2 3.62 3.46a2 2 0 01-.76 2.14L7 8.5V21a1 1 0 001 1h8a1 1 0 001-1V8.5l4.14-2.9a2 2 0 01-.76-2.14z" />
    </svg>
  );
}

function VisualizationIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

const NODE_ICONS: Record<string, () => React.ReactNode> = {
  Preferences: PreferencesIcon,
  Outfit: OutfitIcon,
  Visualization: VisualizationIcon,
};

function NodeLabel({ text, sub }: { text: string; sub?: string }) {
  const IconComponent = NODE_ICONS[text];
  return (
    <div className="flex items-center gap-2 mb-1">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ background: `${ACCENT}18`, border: `1.5px solid ${ACCENT}50` }}
      >
        {IconComponent ? <IconComponent /> : (
          <span className="text-[0.6rem] font-bold" style={{ color: ACCENT }}>
            {text.charAt(0)}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-[0.78rem] font-semibold text-[var(--text)]">{text}</div>
        {sub && (
          <div className="text-[0.6rem] text-[var(--text-muted)]">{sub}</div>
        )}
      </div>
    </div>
  );
}

// ── Preferences Node ───────────────────────────────────

interface PreferencesData {
  [key: string]: unknown;
  preferences: FashionFlowProps["preferences"];
  photoUrl?: string;
  nodeStatus: "pending" | "working" | "done";
  mobile?: boolean;
}

function PreferencesNode({ data }: NodeProps<Node<PreferencesData>>) {
  const { preferences: prefs, photoUrl, nodeStatus, mobile } = data;
  const w = mobile ? NODE_WIDTH_MOBILE : NODE_WIDTH;
  return (
    <>
      <div style={cardStyle({ status: nodeStatus, width: w })}>
        <NodeLabel text="Preferences" sub={nodeStatus === "done" ? "Parsed" : "Parsing..."} />
        {nodeStatus === "working" && <StatusDots />}
        {photoUrl && nodeStatus === "done" && (
          <div className="mt-1.5 rounded-lg overflow-hidden border border-[var(--surface-border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Your photo" className="w-full h-auto max-h-[180px] object-contain" />
          </div>
        )}
        {prefs && nodeStatus === "done" && (
          <div className="flex flex-col gap-0.5 mt-1 text-[0.68rem] text-[var(--text-muted)]">
            <span><b className="text-[var(--text)]">Style:</b> {prefs.style}</span>
            <span><b className="text-[var(--text)]">Occasion:</b> {prefs.occasion}</span>
            <span><b className="text-[var(--text)]">Budget:</b> ${prefs.budget.min}–${prefs.budget.max}</span>
            {prefs.gender && <span><b className="text-[var(--text)]">Gender:</b> {prefs.gender}</span>}
            {prefs.colorPreferences && <span><b className="text-[var(--text)]">Colors:</b> {prefs.colorPreferences}</span>}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle("right")} />
    </>
  );
}

// ── Brand Icons ───────────────────────────────────────

function ZaraIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="central" fill="var(--text)" fontSize="11" fontWeight="900" fontFamily="serif" letterSpacing="-0.5">ZARA</text>
    </svg>
  );
}

function BershkaIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="central" fill="var(--text)" fontSize="7" fontWeight="800" fontFamily="sans-serif" letterSpacing="1.5">BERSHKA</text>
    </svg>
  );
}

function MassimoDuttiIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <text x="50%" y="42%" textAnchor="middle" dominantBaseline="central" fill="var(--text)" fontSize="6.5" fontWeight="700" fontFamily="serif" letterSpacing="0.5">MASSIMO</text>
      <text x="50%" y="62%" textAnchor="middle" dominantBaseline="central" fill="var(--text)" fontSize="6.5" fontWeight="700" fontFamily="serif" letterSpacing="0.5">DUTTI</text>
    </svg>
  );
}

const BRAND_ICONS: Record<string, (props: { size?: number }) => React.ReactNode> = {
  Zara: ZaraIcon,
  Bershka: BershkaIcon,
  "Massimo Dutti": MassimoDuttiIcon,
};

// ── Retailer Node ──────────────────────────────────────

interface RetailerData {
  [key: string]: unknown;
  brand: string;
  products: Pick<ScrapedProduct, "name" | "price" | "imageUrl">[];
  totalCount: number;
  nodeStatus: "pending" | "working" | "done" | "error";
  mobile?: boolean;
}

function RetailerNode({ data }: NodeProps<Node<RetailerData>>) {
  const { brand, products, totalCount, nodeStatus, mobile } = data;
  const w = mobile ? NODE_WIDTH_MOBILE : NODE_WIDTH;
  const BrandIcon = BRAND_ICONS[brand];
  const subText =
    nodeStatus === "done"
      ? `${totalCount} product${totalCount !== 1 ? "s" : ""}`
      : nodeStatus === "error"
        ? "Failed"
        : nodeStatus === "working"
          ? "Searching..."
          : "Pending";

  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle("left")} />
      <div style={cardStyle({ status: nodeStatus, width: w })}>
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
            style={{ background: "var(--surface-raised)", border: "1.5px solid var(--surface-border)" }}
          >
            {BrandIcon ? <BrandIcon size={28} /> : (
              <span className="text-[0.6rem] font-bold" style={{ color: ACCENT }}>
                {brand.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[0.78rem] font-semibold text-[var(--text)]">{brand}</div>
            <div className="text-[0.6rem] text-[var(--text-muted)]">{subText}</div>
          </div>
        </div>
        {nodeStatus === "working" && <StatusDots />}
        {nodeStatus === "done" && products.length > 0 && (
          <div className="grid grid-cols-4 gap-1 mt-1.5">
            {products.slice(0, 4).map((p, i) => (
              <div
                key={i}
                className="w-full aspect-square rounded-md overflow-hidden bg-[var(--surface-raised)] border border-[var(--surface-border)]"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[0.5rem] text-[var(--text-muted)]">?</div>
                )}
              </div>
            ))}
          </div>
        )}
        {nodeStatus === "done" && totalCount === 0 && (
          <div className="text-[0.65rem] text-[var(--text-muted)] mt-1">No products found</div>
        )}
        {nodeStatus === "error" && (
          <div className="text-[0.65rem] text-[var(--error)] mt-1">Retailer unavailable</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle("right")} />
    </>
  );
}

// ── Outfit Node ────────────────────────────────────────

interface OutfitData {
  [key: string]: unknown;
  outfit: FashionFlowProps["outfit"];
  nodeStatus: "pending" | "working" | "done";
  mobile?: boolean;
  width?: number;
}

function OutfitNode({ data }: NodeProps<Node<OutfitData>>) {
  const { outfit, nodeStatus, width: w = 310 } = data;
  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle("left")} />
      <div style={cardStyle({ status: nodeStatus, width: w })}>
        <NodeLabel
          text="Outfit"
          sub={
            nodeStatus === "done" && outfit
              ? `${outfit.items.length} items — $${outfit.totalPrice}`
              : nodeStatus === "working"
                ? "AI curating..."
                : "Pending"
          }
        />
        {nodeStatus === "working" && <StatusDots />}
        {nodeStatus === "done" && outfit && (
          <div className="flex flex-col gap-1 mt-1.5">
            {outfit.items.slice(0, 4).map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                {item.product.imageUrl && (
                  <div className="w-8 h-8 rounded-md overflow-hidden bg-[var(--surface-raised)] shrink-0 border border-[var(--surface-border)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[0.65rem] font-medium text-[var(--text)] truncate">{item.product.name}</div>
                  <div className="text-[0.58rem] text-[var(--text-muted)]">{item.product.brand} — ${item.product.price}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-[var(--surface-border)]">
              <span className="text-[0.62rem] text-[var(--text-muted)]">Total</span>
              <span className="text-[0.72rem] font-bold" style={{ color: ACCENT }}>${outfit.totalPrice}</span>
            </div>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle("right")} />
    </>
  );
}

// ── Image Node ─────────────────────────────────────────

interface ImageData {
  [key: string]: unknown;
  image: FashionFlowProps["image"];
  nodeStatus: "pending" | "working" | "done";
  mobile?: boolean;
  width?: number;
}

function ImageNode({ data }: NodeProps<Node<ImageData>>) {
  const { image, nodeStatus, width: w = 310 } = data;
  const src = image?.base64
    ? `data:image/png;base64,${image.base64}`
    : image?.url;

  return (
    <>
      <Handle type="target" position={Position.Left} style={handleStyle("left")} />
      <div style={cardStyle({ status: nodeStatus, width: w })}>
        <NodeLabel
          text="Visualization"
          sub={
            nodeStatus === "done"
              ? "Generated"
              : nodeStatus === "working"
                ? "Generating..."
                : "Pending"
          }
        />
        {nodeStatus === "working" && <StatusDots />}
        {nodeStatus === "done" && src && (
          <div className="mt-1.5 rounded-lg overflow-hidden border border-[var(--surface-border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="Outfit visualization" className="w-full h-auto object-contain" />
          </div>
        )}
        {nodeStatus === "done" && !src && (
          <div className="text-[0.65rem] text-[var(--text-muted)] mt-1">No image generated</div>
        )}
      </div>
    </>
  );
}

// ── Node types ─────────────────────────────────────────

const nodeTypes = {
  preferencesNode: PreferencesNode,
  retailerNode: RetailerNode,
  outfitNode: OutfitNode,
  imageNode: ImageNode,
};

// ── Layout builder ─────────────────────────────────────

function buildGraph(props: FashionFlowProps, mobile = false): { nodes: Node[]; edges: Edge[] } {
  const { preferences, retailers, outfit, image, photoUrl, currentStage } = props;
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const xGap = mobile ? X_GAP_MOBILE : X_GAP;
  const yGap = mobile ? Y_GAP_MOBILE : Y_GAP;
  const outfitW = mobile ? 240 : 310;
  const imageW = mobile ? 240 : 310;

  const stageOrder = [
    "parsing_preferences",
    "scraping_products",
    "assembling_outfit",
    "generating_image",
    "complete",
  ];
  const stageIdx = stageOrder.indexOf(currentStage);

  // Center Y for the retailer fan-out
  const retailerCenterY = (ALL_BRANDS.length - 1) * yGap / 2;

  // ─ Preferences node (column 0)
  const prefsStatus: "pending" | "working" | "done" =
    stageIdx >= 1 || preferences ? "done" : stageIdx === 0 ? "working" : "pending";

  nodes.push({
    id: "preferences",
    type: "preferencesNode",
    position: { x: 0, y: retailerCenterY - 20 },
    data: { preferences, photoUrl, nodeStatus: prefsStatus, mobile } satisfies PreferencesData,
    draggable: false,
    selectable: false,
  });

  // ─ Retailer nodes (column 1)
  const retailerIds: string[] = [];
  ALL_BRANDS.forEach((brand, i) => {
    const id = `retailer-${brand}`;
    retailerIds.push(id);
    const retailerData = retailers.get(brand);

    let nodeStatus: "pending" | "working" | "done" | "error" = "pending";
    if (retailerData) {
      nodeStatus = retailerData.status === "loading" ? "working" : retailerData.status;
    } else if (stageIdx >= 1) {
      nodeStatus = "working";
    }

    nodes.push({
      id,
      type: "retailerNode",
      position: { x: xGap, y: i * yGap },
      data: {
        brand,
        products: retailerData?.products ?? [],
        totalCount: retailerData?.totalCount ?? 0,
        nodeStatus,
        mobile,
      } satisfies RetailerData,
      draggable: false,
      selectable: false,
    });

    // Edge: preferences → retailer
    const isActive = nodeStatus !== "pending";
    edges.push({
      id: `preferences->${id}`,
      source: "preferences",
      target: id,
      type: "smoothstep",
      animated: nodeStatus === "working",
      style: {
        stroke: isActive ? `${ACCENT}80` : "var(--rf-edge-idle, rgba(255,255,255,0.1))",
        strokeWidth: isActive ? 2 : 1.5,
      },
    });
  });

  // ─ Outfit node (column 2)
  const outfitStatus: "pending" | "working" | "done" =
    outfit ? "done" : stageIdx >= 2 ? "working" : "pending";

  // Only show outfit node once scraping is at least started
  if (stageIdx >= 1 || outfit) {
    nodes.push({
      id: "outfit",
      type: "outfitNode",
      position: { x: xGap * 2, y: retailerCenterY - 30 },
      data: { outfit, nodeStatus: outfitStatus, mobile, width: outfitW } satisfies OutfitData,
      draggable: false,
      selectable: false,
    });

    // Edges: retailers → outfit
    for (const rid of retailerIds) {
      const rData = retailers.get(rid.replace("retailer-", ""));
      const isActive = rData?.status === "done" || outfitStatus !== "pending";
      edges.push({
        id: `${rid}->outfit`,
        source: rid,
        target: "outfit",
        type: "smoothstep",
        animated: outfitStatus === "working",
        style: {
          stroke: isActive ? `${ACCENT}80` : "var(--rf-edge-idle, rgba(255,255,255,0.1))",
          strokeWidth: isActive ? 2 : 1.5,
        },
      });
    }
  }

  // ─ Image node (column 3)
  const imageStatus: "pending" | "working" | "done" =
    image ? "done" : stageIdx >= 3 ? "working" : "pending";

  if (stageIdx >= 2 || image) {
    nodes.push({
      id: "image",
      type: "imageNode",
      position: { x: xGap * 3, y: retailerCenterY - 10 },
      data: { image, nodeStatus: imageStatus, mobile, width: imageW } satisfies ImageData,
      draggable: false,
      selectable: false,
    });

    // Edge: outfit → image
    const isActive = imageStatus !== "pending";
    edges.push({
      id: "outfit->image",
      source: "outfit",
      target: "image",
      type: "smoothstep",
      animated: imageStatus === "working",
      style: {
        stroke: isActive ? `${ACCENT}80` : "var(--rf-edge-idle, rgba(255,255,255,0.1))",
        strokeWidth: isActive ? 2 : 1.5,
      },
    });
  }

  return { nodes, edges };
}

// ── Main component ─────────────────────────────────────

function useDotColor() {
  const [dotColor, setDotColor] = useState("rgba(255,255,255,0.07)");
  useEffect(() => {
    function update() {
      const theme = document.documentElement.getAttribute("data-theme");
      setDotColor(theme === "light" ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.07)");
    }
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return dotColor;
}

export function FashionPipelineFlow(props: FashionFlowProps) {
  const mobile = useIsMobile();
  const { nodes, edges } = useMemo(() => buildGraph(props, mobile), [props, mobile]);
  const dotColor = useDotColor();

  return (
    <ReactFlowProvider>
      <div className="w-full h-full rounded-[var(--radius-lg)] overflow-hidden border border-[var(--glass-border)] bg-[var(--flow-bg)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: mobile ? 0.02 : 0.05, maxZoom: mobile ? 0.55 : 0.85, minZoom: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnDrag
          zoomOnScroll
          zoomOnDoubleClick
          zoomOnPinch
          preventScrolling={false}
          minZoom={0.1}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color={dotColor} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}

// ── Mock preview flow (idle state background) ──────────

function buildMockGraph(mobile = false): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const xGap = mobile ? X_GAP_MOBILE : X_GAP;
  const yGap = mobile ? Y_GAP_MOBILE : Y_GAP;
  const nodeW = mobile ? NODE_WIDTH_MOBILE : NODE_WIDTH;
  const wideW = mobile ? 240 : 310;
  const centerY = (ALL_BRANDS.length - 1) * yGap / 2;

  // Preferences
  nodes.push({
    id: "preferences",
    type: "preferencesNode",
    position: { x: 0, y: centerY - 20 },
    data: {
      preferences: { style: "streetwear", occasion: "casual outing", budget: { min: 50, max: 300, currency: "USD" } },
      nodeStatus: "done",
      mobile,
    } satisfies PreferencesData,
    draggable: false,
    selectable: false,
  });

  // Real product images per brand
  const brandProducts: Record<string, { name: string; price: number; imageUrl: string }[]> = {
    Zara: [
      { name: "Heavyweight T-Shirt", price: 29.9, imageUrl: "https://static.zara.net/assets/public/b7b6/d6c0/0faf4ddfbd86/b326fdf96a41/01887410800-f1/01887410800-f1.jpg?ts=1769022786881&w=563" },
      { name: "Medium Weight T-Shirt", price: 29.9, imageUrl: "https://static.zara.net/assets/public/57c4/aa47/6dd84aeb9bdf/3f3c0a865b26/01887411250-f1/01887411250-f1.jpg?ts=1769023892807&w=563" },
      { name: "Slim Fit T-Shirt", price: 19.9, imageUrl: "https://static.zara.net/assets/public/ce8d/259a/4d3d4527abc6/c449af81c632/01887401250-f1/01887401250-f1.jpg?ts=1769772881882&w=563" },
      { name: "Heavyweight T-Shirt", price: 29.9, imageUrl: "https://static.zara.net/assets/public/72d5/20aa/afdd4e528170/4caf0a882c8a/01887410250-f1/01887410250-f1.jpg?ts=1769013653738&w=563" },
    ],
    Bershka: [
      { name: "Loose Fit Jeans", price: 49.9, imageUrl: "https://static.bershka.net/4/photos2/2026/V/0/2/p/0858/211/433/0858211433_2_1_0.jpg" },
      { name: "Tailored Megabaggy Trousers", price: 79.9, imageUrl: "https://static.bershka.net/4/photos2/2026/V/0/2/p/1210/046/711/1210046711_2_1_0.jpg" },
      { name: "Baggy Cargo Jeans", price: 59.9, imageUrl: "https://static.bershka.net/4/photos2/2026/V/0/2/p/5329/335/811/5329335811_2_1_0.jpg" },
      { name: "Basic Sneakers", price: 49.9, imageUrl: "https://static.bershka.net/4/photos2/2026/V/1/2/p/2407/664/040/2407664040_2_1_0.jpg" },
    ],
    "Massimo Dutti": [
      { name: "Flowing Shirt", price: 160, imageUrl: "https://static.massimodutti.net/3/photos/2026/V/0/1/p/5114/514/600/5114514600_2_1_0.jpg" },
      { name: "Striped Linen Shirt", price: 130, imageUrl: "https://static.massimodutti.net/3/photos/2026/V/0/2/p/1933/263/400/1933263400_2_1_0.jpg" },
      { name: "Bib Front Shirt", price: 160, imageUrl: "https://static.massimodutti.net/3/photos/2026/V/0/1/p/5105/705/250/5105705250_2_1_0.jpg" },
      { name: "Flowing Striped Shirt", price: 130, imageUrl: "https://static.massimodutti.net/3/photos/2026/V/0/1/p/5122/522/700/5122522700_2_1_0.jpg" },
    ],
  };

  ALL_BRANDS.forEach((brand, i) => {
    const id = `retailer-${brand}`;
    const products = brandProducts[brand] ?? [];
    nodes.push({
      id,
      type: "retailerNode",
      position: { x: xGap, y: i * yGap },
      data: {
        brand,
        products: products.map((p) => ({ ...p, brand })),
        totalCount: 20,
        nodeStatus: "done",
        mobile,
      } satisfies RetailerData,
      draggable: false,
      selectable: false,
    });

    edges.push({
      id: `preferences->${id}`,
      source: "preferences",
      target: id,
      type: "smoothstep",
      animated: true,
      style: { stroke: `${ACCENT}60`, strokeWidth: 1.5 },
    });

    edges.push({
      id: `${id}->outfit`,
      source: id,
      target: "outfit",
      type: "smoothstep",
      animated: true,
      style: { stroke: `${ACCENT}40`, strokeWidth: 1.5 },
    });
  });

  // Outfit with real product images
  const mockOutfit = {
    items: [
      { product: { name: "Heavyweight T-Shirt", brand: "Zara", price: 29.9, imageUrl: "https://static.zara.net/assets/public/b7b6/d6c0/0faf4ddfbd86/b326fdf96a41/01887410800-f1/01887410800-f1.jpg?ts=1769022786881&w=563", url: "", category: "top" }, explanation: "" },
      { product: { name: "Loose Fit Jeans", brand: "Bershka", price: 49.9, imageUrl: "https://static.bershka.net/4/photos2/2026/V/0/2/p/0858/211/433/0858211433_2_1_0.jpg", url: "", category: "bottom" }, explanation: "" },
      { product: { name: "Basic Sneakers", brand: "Bershka", price: 49.9, imageUrl: "https://static.bershka.net/4/photos2/2026/V/1/2/p/2407/664/040/2407664040_2_1_0.jpg", url: "", category: "shoes" }, explanation: "" },
    ] as OutfitItem[],
    totalPrice: 129.7,
    currency: "USD",
    explanation: "A clean streetwear look",
  };

  nodes.push({
    id: "outfit",
    type: "outfitNode",
    position: { x: xGap * 2, y: centerY - 30 },
    data: { outfit: mockOutfit, nodeStatus: "done", mobile, width: wideW } satisfies OutfitData,
    draggable: false,
    selectable: false,
  });

  // Image with mock visualization
  nodes.push({
    id: "image",
    type: "imageNode",
    position: { x: xGap * 3, y: centerY - 10 },
    data: { image: { url: "https://static.zara.net/assets/public/8266/40f5/22444b2f8550/2e2b03128ec7/02100828715-p/02100828715-p.jpg?ts=1772470724724&w=563" }, nodeStatus: "done", mobile, width: wideW } satisfies ImageData,
    draggable: false,
    selectable: false,
  });

  edges.push({
    id: "outfit->image",
    source: "outfit",
    target: "image",
    type: "smoothstep",
    animated: true,
    style: { stroke: `${ACCENT}60`, strokeWidth: 1.5 },
  });

  return { nodes, edges };
}

// ── Exports for unified flow ────────────────────────────
export {
  ACCENT, ALL_BRANDS, Y_GAP, Y_GAP_MOBILE, X_GAP, X_GAP_MOBILE,
  NODE_WIDTH, NODE_WIDTH_MOBILE,
  cardStyle, handleStyle, StatusDots, NodeLabel,
  nodeTypes, useIsMobile, useDotColor,
};
export type { PreferencesData, RetailerData, OutfitData, ImageData };

export function FashionFlowPreview() {
  const mobile = useIsMobile();
  const { nodes, edges } = useMemo(() => buildMockGraph(mobile), [mobile]);
  const dotColor = useDotColor();

  return (
    <ReactFlowProvider>
      <div className="w-full h-full rounded-[var(--radius-lg)] overflow-hidden bg-[var(--flow-bg)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: mobile ? 0.02 : 0.18, maxZoom: mobile ? 0.45 : 0.85, minZoom: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          zoomOnPinch={false}
          preventScrolling={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={dotColor} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
