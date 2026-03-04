"use client";

import { useMemo, useState, useCallback } from "react";
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

/* ── Node data types ─────────────────────────────────── */

interface FlowNodeData {
  [key: string]: unknown;
  label: string;
  subtitle?: string;
  color: string;
  icon: "user" | "team" | "agent" | "deploy" | "result";
}

/* ── Step definitions ────────────────────────────────── */

const STEPS = [
  { id: "request",  label: "Your Request",  subtitle: "Describe what you need", color: "#22c55e", icon: "user"   as const, x: 0,   y: 100 },
  { id: "team",     label: "AI Team",       subtitle: "Auto-assigns agents",    color: "#a78bfa", icon: "team"   as const, x: 200, y: 100 },
  { id: "agent-1",  label: "PM",            subtitle: "Plans & specs",          color: "#f59e0b", icon: "agent"  as const, x: 400, y: 0   },
  { id: "agent-2",  label: "Engineer",      subtitle: "Builds features",        color: "#3b82f6", icon: "agent"  as const, x: 400, y: 100 },
  { id: "agent-3",  label: "QA",            subtitle: "Tests & reviews",        color: "#ef4444", icon: "agent"  as const, x: 400, y: 200 },
  { id: "deploy",   label: "Delivery",      subtitle: "Production-ready",       color: "#22c55e", icon: "result" as const, x: 600, y: 100 },
];

/* ── Icons ───────────────────────────────────────────── */

function NodeIcon({ icon, color, size = 20 }: { icon: string; color: string; size?: number }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: "1.8", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (icon) {
    case "user":
      return <svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
    case "team":
      return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "agent":
      return <svg {...props}><path d="M12 8V4H8" /><rect x="4" y="8" width="16" height="12" rx="2" /><circle cx="9" cy="14" r="1.5" fill={color} /><circle cx="15" cy="14" r="1.5" fill={color} /></svg>;
    case "result":
      return <svg {...props}><polyline points="20 6 9 17 4 12" /></svg>;
    default:
      return null;
  }
}

/* ── Custom node ─────────────────────────────────────── */

function StepNode({ data }: NodeProps<Node<FlowNodeData>>) {
  const { label, subtitle, color, icon } = data;

  return (
    <div className="flex flex-col items-center gap-1.5 cursor-grab">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      <div
        className="size-12 rounded-2xl flex items-center justify-center border transition-shadow"
        style={{
          background: `${color}10`,
          borderColor: `${color}30`,
          boxShadow: `0 0 20px ${color}15, 0 4px 12px rgba(0,0,0,0.1)`,
        }}
      >
        <NodeIcon icon={icon} color={color} />
      </div>
      <span className="text-[0.72rem] font-semibold text-[var(--text)] text-center leading-tight">{label}</span>
      {subtitle && (
        <span className="text-[0.58rem] text-[var(--text-muted)] text-center leading-tight max-w-[90px]">{subtitle}</span>
      )}
    </div>
  );
}

const nodeTypes = { step: StepNode };

/* ── Flow component ──────────────────────────────────── */

function TeamFlowGraph() {
  const initialNodes: Node<FlowNodeData>[] = useMemo(() =>
    STEPS.map((s) => ({
      id: s.id,
      type: "step",
      position: { x: s.x, y: s.y },
      data: { label: s.label, subtitle: s.subtitle, color: s.color, icon: s.icon },
      draggable: true,
    })),
  []);

  const edges: Edge[] = useMemo(() => [
    { id: "e1", source: "request", target: "team",    animated: true, style: { stroke: "#22c55e60", strokeWidth: 2 } },
    { id: "e2", source: "team",    target: "agent-1", animated: true, style: { stroke: "#a78bfa50", strokeWidth: 2 } },
    { id: "e3", source: "team",    target: "agent-2", animated: true, style: { stroke: "#a78bfa50", strokeWidth: 2 } },
    { id: "e4", source: "team",    target: "agent-3", animated: true, style: { stroke: "#a78bfa50", strokeWidth: 2 } },
    { id: "e5", source: "agent-1", target: "deploy",  animated: true, style: { stroke: "#22c55e40", strokeWidth: 1.5 } },
    { id: "e6", source: "agent-2", target: "deploy",  animated: true, style: { stroke: "#22c55e40", strokeWidth: 1.5 } },
    { id: "e7", source: "agent-3", target: "deploy",  animated: true, style: { stroke: "#22c55e40", strokeWidth: 1.5 } },
  ], []);

  const [nodes, setNodes] = useState(initialNodes);
  const onNodesChange: OnNodesChange<Node<FlowNodeData>> = useCallback(
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
      fitViewOptions={{ padding: 0.3 }}
      proOptions={{ hideAttribution: true }}
      panOnDrag
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      preventScrolling={false}
      minZoom={0.4}
      maxZoom={1.2}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    />
  );
}

/* ── Exported hero ───────────────────────────────────── */

export function TeamFlowHero() {
  return (
    <div className="relative rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[12px] overflow-hidden">
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 30% 50%, rgba(167,139,250,0.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(34,197,94,0.05) 0%, transparent 60%)",
        }}
      />

      {/* Flow */}
      <div className="h-[220px] sm:h-[260px]">
        <ReactFlowProvider>
          <TeamFlowGraph />
        </ReactFlowProvider>
      </div>

      {/* Bottom bar */}
      <div className="relative flex items-center justify-between px-4 sm:px-6 py-3 border-t border-[var(--glass-border)] bg-[var(--surface-raised)]">
        <div className="flex items-center gap-2 text-[0.72rem] text-[var(--text-muted)]">
          <span className="size-1.5 rounded-full bg-[#22c55e] shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
          <span>How AI teams work</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-[0.65rem] text-[var(--text-muted)]">
          <span>1. Describe your task</span>
          <span className="opacity-30">&rarr;</span>
          <span>2. Team auto-assigns agents</span>
          <span className="opacity-30">&rarr;</span>
          <span>3. Agents collaborate & deliver</span>
        </div>
      </div>
    </div>
  );
}
