"use client";

import { CSSProperties, useRef, useEffect, useState, useCallback, useMemo } from "react";
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
  { id: "orchestrator", label: "Orchestrator", color: "#22c55e", videoSrc: `${PICSART_CDN}/70483c73-3cd7-428f-ab17-95a56f4343d4.mp4`, x: 300, y: 240, isCenter: true },
  { id: "product_manager", label: "PM", color: "#a78bfa", videoSrc: `${PICSART_CDN}/c5d7d947-756b-4da6-bf6d-f5b3a830736c.mp4`, x: 100, y: 60 },
  { id: "frontend_developer", label: "Developer", color: "#34d399", videoSrc: `${PICSART_CDN}/7aab607b-d861-44d3-b5e0-d0233be39ff6.mp4`, x: 500, y: 70 },
  { id: "qa", label: "QA", color: "#facc15", videoSrc: `${PICSART_CDN}/71fd37ab-de45-474e-89ce-edc39a060935.mp4`, x: 60, y: 400 },
  { id: "devops", label: "DevOps", color: "#f97316", videoSrc: `${PICSART_CDN}/254781f4-6575-4cea-b2ac-18ad2e2fc7ca.mp4`, x: 420, y: 430 },
  { id: "add", label: "+", color: "var(--text-muted)", videoSrc: "", x: 560, y: 280, isPlaceholder: true },
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
      <div style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "1.5px dashed var(--glass-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: "1.2rem",
        cursor: "grab",
      }}>
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
        +
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "0.4rem",
      cursor: "grab",
    }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} style={{ opacity: 0 }} />

      <div style={{ position: "relative" }}>
        <div style={{
          width: size,
          height: size,
          borderRadius: isCenter ? 18 : 14,
          background: isCenter ? `${color}12` : "var(--surface-raised)",
          border: isCenter ? `2px solid ${color}50` : "1px solid var(--glass-border)",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isCenter
            ? `0 0 40px ${color}20, 0 8px 32px rgba(0,0,0,0.3)`
            : "0 4px 20px rgba(0,0,0,0.15)",
        }}>
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: size * 1.2,
              height: size * 1.2,
              objectFit: "cover",
              pointerEvents: "none",
            }}
          />
        </div>
        {!isCenter && (
          <div style={{
            position: "absolute",
            top: -4,
            right: -4,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--bg, #0a0a0a)",
            border: `1.5px solid ${color}60`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
              <path d="M12 2a10 10 0 0 1 0 20" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
        )}
      </div>

      <span style={{
        fontSize: isCenter ? "0.82rem" : "0.68rem",
        fontWeight: 600,
        color: isCenter ? "var(--text)" : "var(--text-muted)",
        textAlign: "center",
      }}>
        {label}
      </span>

      {isCenter && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0.3rem",
          padding: "0.15rem 0.5rem",
          borderRadius: 9999,
          background: `${color}18`,
          border: `1px solid ${color}30`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
          <span style={{ fontSize: "0.6rem", color, fontWeight: 600 }}>Running</span>
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

  const feed: CSSProperties = {
    width: 340,
    flexShrink: 0,
    borderRadius: 18,
    border: "1px solid var(--glass-border)",
    background: "var(--glass-bg)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    padding: "1.25rem 1.5rem",
    animation: "landing-fade-up 0.6s ease-out 0.5s both",
  };

  return (
    <div className="landing-activity-feed" style={feed}>
      <div style={{
        fontSize: "0.75rem",
        fontWeight: 700,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        marginBottom: "1rem",
        paddingBottom: "0.65rem",
        borderBottom: "1px solid var(--glass-border)",
      }}>
        Activity
      </div>
      {ACTIVITY_ITEMS.slice(0, visibleItems).map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.85rem",
            padding: "0.75rem 0",
            borderBottom: i < ACTIVITY_ITEMS.length - 1 ? "1px solid var(--glass-border)" : "none",
            animation: "landing-fade-up 0.3s ease-out both",
          }}
        >
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${item.color}12`,
            border: `1px solid ${item.color}25`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            {item.icon === "clipboard" && <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round"><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></svg>}
            {item.icon === "code" && <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>}
            {item.icon === "check" && <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>}
            {item.icon === "rocket" && <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /></svg>}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--text)", lineHeight: 1.35 }}>{item.text}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>Just now</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Task bar ────────────────────────────────────────── */

function TaskBar() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
      padding: "0.6rem 1.25rem",
      borderRadius: 12,
      border: "1px solid var(--glass-border)",
      background: "var(--glass-bg)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
      animation: "landing-fade-up 0.6s ease-out 0.7s both",
      whiteSpace: "nowrap",
      justifyContent: "center",
      marginTop: "1rem",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round">
        <rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      </svg>
      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Building auth module...</span>
      <div style={{ width: 80, height: 4, borderRadius: 2, background: "var(--surface-raised)", overflow: "hidden" }}>
        <div style={{
          width: "65%",
          height: "100%",
          borderRadius: 2,
          background: "linear-gradient(90deg, #22c55e, #34d399)",
          animation: "landing-progress 3s ease-in-out infinite",
        }} />
      </div>
    </div>
  );
}

/* ── React Flow graph ────────────────────────────────── */

function AgentGraph() {
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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.45 }}
      proOptions={{ hideAttribution: true }}
      panOnDrag
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      preventScrolling={false}
      minZoom={0.4}
      maxZoom={1.2}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
    </ReactFlow>
  );
}

/* ── Exported section ────────────────────────────────── */

const section: CSSProperties = {
  position: "relative",
  padding: "1rem 1.5rem 2rem",
  display: "flex",
  justifyContent: "center",
};

const vizWrapper: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 960,
  display: "flex",
  gap: "2rem",
  alignItems: "flex-start",
};

export function AgentVisualization() {
  return (
    <section style={section}>
      <div className="landing-viz-wrapper" style={vizWrapper}>
        <div style={{ flex: "1 1 auto", minWidth: 0, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="landing-viz-graph" style={{ width: "100%", height: 480 }}>
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
