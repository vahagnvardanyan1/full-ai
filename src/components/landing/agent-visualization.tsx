"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type OnNodesChange,
  applyNodeChanges,
} from "@xyflow/react";

const PICSART_CDN = "https://cdn-cms-uploads.picsart.com/cms-uploads";

/* ── Agent data ──────────────────────────────────────── */

interface LandingNodeData {
  [key: string]: unknown;
  label: string;
  color: string;
  videoSrc: string;
  isCenter?: boolean;
}

const AGENT_DEFS = [
  { id: "orchestrator", label: "Orchestrator", color: "#22c55e", videoSrc: `${PICSART_CDN}/70483c73-3cd7-428f-ab17-95a56f4343d4.mp4`, x: 250, y: 200, isCenter: true },
  { id: "product_manager", label: "PM", color: "#a78bfa", videoSrc: `${PICSART_CDN}/c5d7d947-756b-4da6-bf6d-f5b3a830736c.mp4`, x: 80, y: 40 },
  { id: "frontend_developer", label: "Developer", color: "#34d399", videoSrc: `${PICSART_CDN}/7aab607b-d861-44d3-b5e0-d0233be39ff6.mp4`, x: 420, y: 40 },
  { id: "qa", label: "QA", color: "#facc15", videoSrc: `${PICSART_CDN}/71fd37ab-de45-474e-89ce-edc39a060935.mp4`, x: 80, y: 370 },
  { id: "devops", label: "DevOps", color: "#f97316", videoSrc: `${PICSART_CDN}/254781f4-6575-4cea-b2ac-18ad2e2fc7ca.mp4`, x: 420, y: 370 },
  { id: "add", label: "+", color: "var(--text-muted)", videoSrc: "", x: 480, y: 200, isPlaceholder: true },
];

const ACTIVITY_ITEMS = [
  { agent: "PM", icon: "clipboard", text: "Spec drafted for auth module", color: "#a78bfa" },
  { agent: "Dev", icon: "code", text: "Generated 12 components", color: "#34d399" },
  { agent: "QA", icon: "check", text: "All 24 tests passing", color: "#facc15" },
  { agent: "DevOps", icon: "rocket", text: "Deployed to staging", color: "#f97316" },
];

/* ── Custom node: Agent ──────────────────────────────── */

function LandingAgentNode({ data }: NodeProps<Node<LandingNodeData>>) {
  const { label, color, videoSrc, isCenter } = data;
  const videoRef = useRef<HTMLVideoElement>(null);
  const size = isCenter ? 80 : 56;

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 0.8;
  }, []);

  // Placeholder "+" node
  if (!videoSrc) {
    return (
      <div className="size-10 rounded-full border-[1.5px] border-dashed border-[var(--glass-border)] flex items-center justify-center text-[var(--text-muted)] text-[1.2rem] cursor-grab">
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
        +
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-[0.4rem] cursor-grab">
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} style={{ opacity: 0 }} />

      <div className="relative">
        <div
          className="overflow-hidden flex items-center justify-center"
          style={{
            width: size,
            height: size,
            borderRadius: isCenter ? 18 : 14,
            background: isCenter ? `${color}12` : "var(--surface-raised)",
            border: isCenter ? `2px solid ${color}50` : "1px solid var(--glass-border)",
            boxShadow: isCenter
              ? `0 0 40px ${color}20, 0 8px 32px rgba(0,0,0,0.3)`
              : "0 4px 20px rgba(0,0,0,0.15)",
          }}
        >
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            className="pointer-events-none object-cover"
            style={{ width: size * 1.2, height: size * 1.2 }}
          />
        </div>
        {!isCenter && (
          <div
            className="absolute -top-1 -right-1 size-[18px] rounded-full flex items-center justify-center"
            style={{
              background: "var(--bg, #0a0a0a)",
              border: `1.5px solid ${color}60`,
            }}
          >
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
              <path d="M12 2a10 10 0 0 1 0 20" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
        )}
      </div>

      <span
        className="text-center font-semibold"
        style={{
          fontSize: isCenter ? "0.82rem" : "0.68rem",
          color: isCenter ? "var(--text)" : "var(--text-muted)",
        }}
      >
        {label}
      </span>

      {isCenter && (
        <div
          className="flex items-center gap-[0.3rem] px-2 py-[0.15rem] rounded-full"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          <span className="size-1.5 rounded-full" style={{ background: color }} />
          <span className="text-[0.6rem] font-semibold" style={{ color }}>Running</span>
        </div>
      )}
    </div>
  );
}

const nodeTypes = { landingAgent: LandingAgentNode };

/* ── Activity feed ───────────────────────────────────── */

function ActivityFeed() {
  const [visibleItems, setVisibleItems] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    ACTIVITY_ITEMS.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleItems(i + 1), 800 + i * 600));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      className="landing-activity-feed w-[340px] shrink-0 rounded-[18px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[12px] [-webkit-backdrop-filter:blur(12px)] px-6 py-5"
      style={{ animation: "landing-fade-up 0.6s ease-out 0.5s both" }}
    >
      <div className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-[0.1em] mb-4 pb-[0.65rem] border-b border-[var(--glass-border)]">
        Activity
      </div>
      {ACTIVITY_ITEMS.slice(0, visibleItems).map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-3.5 py-3 animate-landing-fade-up"
          style={{ borderBottom: i < ACTIVITY_ITEMS.length - 1 ? "1px solid var(--glass-border)" : "none" }}
        >
          <div
            className="size-10 rounded-[10px] flex items-center justify-center shrink-0"
            style={{ background: `${item.color}12`, border: `1px solid ${item.color}25` }}
          >
            {item.icon === "clipboard" && <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></svg>}
            {item.icon === "code" && <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>}
            {item.icon === "check" && <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>}
            {item.icon === "rocket" && <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /></svg>}
          </div>
          <div className="min-w-0">
            <div className="text-[0.88rem] font-medium text-[var(--text)] leading-[1.35]">{item.text}</div>
            <div className="text-[0.7rem] text-[var(--text-muted)] mt-0.5">Just now</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Task bar ────────────────────────────────────────── */

function TaskBar() {
  return (
    <div
      className="flex items-center gap-3 px-5 py-[0.6rem] rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[12px] [-webkit-backdrop-filter:blur(12px)] shadow-[0_4px_24px_rgba(0,0,0,0.2)] whitespace-nowrap justify-center mt-4"
      style={{ animation: "landing-fade-up 0.6s ease-out 0.7s both" }}
    >
      <span className="size-[7px] rounded-full bg-[#22c55e] shrink-0" />
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round">
        <rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      </svg>
      <span className="text-[0.75rem] text-[var(--text-muted)]">Building auth module...</span>
      <div className="w-20 h-1 rounded-sm bg-[var(--surface-raised)] overflow-hidden">
        <div className="h-full rounded-sm bg-gradient-to-r from-[#22c55e] to-[#34d399] animate-landing-progress" style={{ width: "65%" }} />
      </div>
    </div>
  );
}

/* ── React Flow graph ────────────────────────────────── */

function AgentGraph() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const initialNodes: Node<LandingNodeData>[] = useMemo(() =>
    AGENT_DEFS.map((a) => ({
      id: a.id,
      type: "landingAgent",
      position: { x: a.x, y: a.y },
      data: {
        label: a.label,
        color: a.color,
        videoSrc: a.videoSrc,
        isCenter: !!(a as Record<string, unknown>).isCenter,
      },
      draggable: true,
    })),
  []);

  const edges: Edge[] = useMemo(() => [
    { id: "e-pm", source: "orchestrator", target: "product_manager", animated: true, style: { stroke: "#a78bfa80", strokeWidth: 2.5 } },
    { id: "e-dev", source: "orchestrator", target: "frontend_developer", animated: true, style: { stroke: "#34d39980", strokeWidth: 2.5 } },
    { id: "e-qa", source: "orchestrator", target: "qa", animated: true, style: { stroke: "#facc1580", strokeWidth: 2.5 } },
    { id: "e-devops", source: "orchestrator", target: "devops", animated: true, style: { stroke: "#f9731680", strokeWidth: 2.5 } },
    { id: "e-add", source: "orchestrator", target: "add", animated: false, style: { stroke: "var(--glass-border)", strokeWidth: 1.5, strokeDasharray: "4 4", opacity: 0.5 } },
  ], []);

  const [nodes, setNodes] = useState(initialNodes);

  const onNodesChange: OnNodesChange<Node<LandingNodeData>> = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const fitViewOptions = useMemo(() => ({
    padding: isMobile ? 0.25 : 0.45,
    nodes: AGENT_DEFS.filter(a => a.id !== "add").map(a => ({ id: a.id })),
  }), [isMobile]);

  return (
    <ReactFlow
      key={isMobile ? "mobile" : "desktop"}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={fitViewOptions}
      proOptions={{ hideAttribution: true }}
      panOnDrag
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      preventScrolling={false}
      minZoom={0.3}
      maxZoom={1.2}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
    </ReactFlow>
  );
}

/* ── Exported section ────────────────────────────────── */

export function AgentVisualization() {
  return (
    <section className="landing-viz-section relative px-6 py-4 pb-8">
      <div className="landing-viz-wrapper relative max-w-[960px] mx-auto flex gap-8 items-center md:items-start">
        <div className="flex-1 min-w-0 rounded-2xl overflow-hidden flex flex-col">
          <div className="landing-viz-graph w-full h-[480px]">
            <ReactFlowProvider>
              <AgentGraph />
            </ReactFlowProvider>
          </div>
          <div className="landing-taskbar"><TaskBar /></div>
        </div>
        <ActivityFeed />
      </div>
    </section>
  );
}
