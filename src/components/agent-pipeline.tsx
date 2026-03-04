"use client";

import { useMemo, useState, useEffect, useRef, CSSProperties, useCallback } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import { AgentAvatar, type AvatarStatus } from "@/components/agent-avatar";
import type { AgentRole, AgentResponse, TaskItem, GeneratedFile } from "@/lib/agents/types";

// ── Types ──────────────────────────────────────────────

export interface AgentNodeData {
  [key: string]: unknown;
  role: string;
  label: string;
  status: AvatarStatus;
  color: string;
  summary?: string;
  taskCount?: number;
  fileCount?: number;
  /** Which GitHub action this agent performed, if any */
  githubAction?: "pushed" | "pr" | "issue";
}

interface AgentPipelineProps {
  phases: AgentRole[][];
  workingAgents: string[];
  completedAgents: string[];
  errorAgent?: string | null;
  agentOutputs: Map<string, { response: AgentResponse; tasks: TaskItem[]; files: GeneratedFile[] }>;
  selectedAgent: string | null;
  onSelectAgent: (agentId: string | null) => void;
}

// ── Agent colors ───────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  product_manager: "#a78bfa",
  frontend_developer: "#34d399",
  qa: "#facc15",
  devops: "#f97316",
  orchestrator: "#60a5fa",
};

function formatAgentName(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trim() + "...";
}

// ── Custom AgentNode ───────────────────────────────────

function AgentNode({ data, selected }: NodeProps<Node<AgentNodeData>>) {
  const { role, label, status, color, summary, taskCount, fileCount, githubAction } = data;

  const isWorking = status === "working";
  const isDone = status === "done";
  const isError = status === "error";
  const isIdle = status === "idle";

  // Show GitHub animation when an agent actually made a GitHub action (PR, issue)
  const prevStatusRef = useRef(status);
  const [justPushed, setJustPushed] = useState(false);
  const [pushLabel, setPushLabel] = useState("");

  useEffect(() => {
    if (prevStatusRef.current === "working" && status === "done" && githubAction) {
      setPushLabel(githubAction === "pr" ? "PR Created" : githubAction === "issue" ? "Issue Created" : "Pushed");
      setJustPushed(true);
      const timer = setTimeout(() => setJustPushed(false), 2800);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = status;
  }, [status, githubAction]);

  const card: CSSProperties = {
    position: "relative",
    background: selected ? "var(--surface-hover)" : "var(--glass-bg)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: isError
      ? "1.5px solid var(--error)"
      : isWorking
        ? `1.5px solid ${color}`
        : isDone
          ? `1px solid ${color}60`
          : "1px dashed var(--idle-border)",
    borderRadius: 14,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: 220,
    opacity: isIdle ? 0.45 : 1,
    transition: "all 0.3s ease, opacity 0.4s ease",
    animation: isWorking
      ? "glow-pulse 2s ease-in-out infinite"
      : justPushed
        ? "push-celebrate 0.5s ease-out forwards"
        : undefined,
    cursor: isDone ? "pointer" : "default",
    // @ts-expect-error CSS custom property
    "--glow-color": `${color}40`,
    boxShadow: selected ? `0 0 0 2px ${color}50, var(--node-shadow)` : "var(--node-shadow)",
    overflow: "hidden",
  };

  const metaRow: CSSProperties = {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    alignItems: "center",
  };

  const metaBadge: CSSProperties = {
    fontSize: "0.6rem",
    padding: "2px 6px",
    borderRadius: 6,
    background: "var(--surface-raised)",
    border: "1px solid var(--surface-border)",
    color: "var(--text-muted)",
    fontWeight: 500,
  };

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: color, width: 8, height: 8, border: "2px solid var(--bg)" }} />
      <div style={card}>
        {/* GitHub push overlay */}
        {justPushed && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: "rgba(0, 0, 0, 0.65)",
              backdropFilter: "blur(4px)",
              borderRadius: 13,
              zIndex: 10,
              animation: "github-push-overlay 2.8s ease-out forwards",
            }}
          >
            <svg width={28} height={28} viewBox="0 0 98 96" fill="#22c55e" style={{ animation: "github-push-icon 0.6s ease-out forwards" }}>
              <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" />
            </svg>
            <span
              style={{
                fontSize: "0.6rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#22c55e",
              }}
            >
              {pushLabel}
            </span>
          </div>
        )}

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AgentAvatar role={role} size={30} status={status} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text)" }}>{label}</div>
            <div
              style={{
                fontSize: "0.6rem",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: isError ? "var(--error)" : isWorking ? color : isDone ? "var(--success)" : "var(--text-muted)",
              }}
            >
              {isWorking ? "Working..." : isDone ? "Complete" : isError ? "Error" : "Pending"}
            </div>
          </div>
          {isDone && (
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" fill="#22c55e" opacity="0.15" />
              <polyline points="5,8 7.2,10.5 11,5.5" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          )}
        </div>

        {/* Working animation */}
        {isWorking && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 2 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: color,
                  display: "inline-block",
                  animation: `dot-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
                }}
              />
            ))}
          </div>
        )}

        {/* Summary preview */}
        {isDone && summary && (
          <div
            style={{
              fontSize: "0.72rem",
              lineHeight: 1.4,
              color: "var(--summary-dim)",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {truncate(summary.replace(/```[\s\S]*?```/g, "[code]"), 120)}
          </div>
        )}

        {/* Meta badges */}
        {isDone && (taskCount || fileCount) ? (
          <div style={metaRow}>
            {taskCount ? (
              <span style={metaBadge}>
                <span style={{ color }}>{taskCount}</span> {taskCount === 1 ? "task" : "tasks"}
              </span>
            ) : null}
            {fileCount ? (
              <span style={metaBadge}>
                <span style={{ color }}>{fileCount}</span> {fileCount === 1 ? "file" : "files"}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8, border: "2px solid var(--bg)" }} />
    </>
  );
}

// ── Start node ─────────────────────────────────────────

function StartNode({ data }: NodeProps<Node<AgentNodeData>>) {
  const color = data.color;
  return (
    <>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: `${color}18`,
          border: `1.5px solid ${color}50`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 20px ${color}20`,
        }}
      >
        <AgentAvatar role="orchestrator" size={28} status="done" />
      </div>
      <Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8, border: "2px solid var(--bg)" }} />
    </>
  );
}

const nodeTypes = { agentNode: AgentNode, startNode: StartNode };

// ── Layout ─────────────────────────────────────────────

const X_SPACING = 280;
const Y_SPACING = 130;
const START_X = 60;

function buildNodesAndEdges(
  phases: AgentRole[][],
  workingAgents: string[],
  completedAgents: string[],
  agentOutputs: Map<string, { response: AgentResponse; tasks: TaskItem[]; files: GeneratedFile[] }>,
  errorAgent?: string | null,
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Total vertical extent
  const maxPhaseSize = Math.max(...phases.map((p) => p.length), 1);
  const totalHeight = (maxPhaseSize - 1) * Y_SPACING;
  const centerY = 80 + totalHeight / 2;

  // Start node
  nodes.push({
    id: "start",
    type: "startNode",
    position: { x: START_X, y: centerY - 24 },
    data: { role: "orchestrator", label: "Start", status: "done" as AvatarStatus, color: AGENT_COLORS.orchestrator },
    draggable: false,
    selectable: false,
    width: 48,
    height: 48,
  });

  let prevPhaseIds: string[] = ["start"];

  phases.forEach((phase, phaseIdx) => {
    const phaseX = START_X + (phaseIdx + 1) * X_SPACING;
    const phaseTopY = centerY - ((phase.length - 1) * Y_SPACING) / 2;
    const currentPhaseIds: string[] = [];

    phase.forEach((role, roleIdx) => {
      const id = `${role}-${phaseIdx}`;
      currentPhaseIds.push(id);

      let status: AvatarStatus = "idle";
      if (errorAgent === role) status = "error";
      else if (completedAgents.includes(role)) status = "done";
      else if (workingAgents.includes(role)) status = "working";

      const color = AGENT_COLORS[role] ?? "#888";
      const output = agentOutputs.get(role);

      // Detect GitHub actions from tool calls
      const toolCalls = output?.response.toolCalls ?? [];
      const githubAction: AgentNodeData["githubAction"] =
        toolCalls.some((t) => t.tool === "create_github_pull_request") ? "pr"
        : toolCalls.some((t) => t.tool === "create_github_issue") ? "issue"
        : undefined;

      nodes.push({
        id,
        type: "agentNode",
        position: { x: phaseX, y: phaseTopY + roleIdx * Y_SPACING },
        data: {
          role,
          label: formatAgentName(role),
          status,
          color,
          summary: output?.response.summary,
          taskCount: output?.tasks.length ?? 0,
          fileCount: output?.files.length ?? 0,
          githubAction,
        } satisfies AgentNodeData,
        draggable: false,
        selectable: status === "done",
        width: 220,
        height: 100,
      });

      for (const prevId of prevPhaseIds) {
        const isActive = status === "working" || status === "done" || status === "error";
        edges.push({
          id: `${prevId}->${id}`,
          source: prevId,
          target: id,
          type: "smoothstep",
          animated: status === "working",
          style: {
            stroke: isActive ? `${color}80` : "var(--rf-edge-idle)",
            strokeWidth: isActive ? 2 : 1.5,
          },
        });
      }
    });

    prevPhaseIds = currentPhaseIds;
  });

  return { nodes, edges };
}

// ── Main component ─────────────────────────────────────

export function AgentPipeline({
  phases,
  workingAgents,
  completedAgents,
  errorAgent,
  agentOutputs,
  selectedAgent,
  onSelectAgent,
}: AgentPipelineProps) {
  const { nodes, edges } = useMemo(
    () => buildNodesAndEdges(phases, workingAgents, completedAgents, agentOutputs, errorAgent),
    [phases, workingAgents, completedAgents, agentOutputs, errorAgent],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const data = node.data as unknown as AgentNodeData;
      if (data.status === "done") {
        onSelectAgent(selectedAgent === data.role ? null : data.role);
      }
    },
    [onSelectAgent, selectedAgent],
  );

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

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={() => onSelectAgent(null)}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.2, minZoom: 0.5 }}
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        zoomOnPinch
        preventScrolling={false}
        minZoom={0.4}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color={dotColor} />
        <MiniMap
          nodeStrokeWidth={3}
          nodeBorderRadius={4}
          nodeStrokeColor={(node) => {
            const data = node.data as Record<string, unknown>;
            return (data.color as string) ?? "#888";
          }}
          nodeColor={(node) => {
            const data = node.data as Record<string, unknown>;
            const color = (data.color as string) ?? "#888";
            return `${color}30`;
          }}
          maskColor="transparent"
          style={{
            background: "var(--bg-secondary)",
            borderRadius: 8,
            border: "1px solid var(--border)",
            top: 10,
            left: 10,
            bottom: "auto",
            right: "auto",
          }}
          pannable
          zoomable
        />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
