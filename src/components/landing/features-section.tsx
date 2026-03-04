"use client";

import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";

const PICSART_CDN = "https://cdn-cms-uploads.picsart.com/cms-uploads";

/* ── Section wrapper ─────────────────────────────────── */

const section: CSSProperties = {
  padding: "5rem 1.5rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "5rem",
};

const sectionLabel: CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  marginBottom: "0.5rem",
  textAlign: "center",
};

const sectionTitle: CSSProperties = {
  fontSize: "clamp(1.5rem, 3.5vw, 2.5rem)",
  fontWeight: 700,
  fontFamily: "var(--font-display)",
  color: "var(--text)",
  textAlign: "center",
  letterSpacing: "-0.025em",
  marginBottom: "1rem",
};

/* ── Feature row (alternating layout) ────────────────── */

function FeatureRow({
  label,
  title,
  description,
  visual,
  reversed,
}: {
  label: string;
  title: string;
  description: string;
  visual: ReactNode;
  reversed?: boolean;
}) {
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "4rem",
    maxWidth: 960,
    width: "100%",
    flexDirection: reversed ? "row-reverse" : "row",
    flexWrap: "wrap",
  };

  const textCol: CSSProperties = {
    flex: "1 1 300px",
    minWidth: 280,
  };

  const vizCol: CSSProperties = {
    flex: "1 1 440px",
    minWidth: 340,
  };

  return (
    <div style={rowStyle}>
      <div style={textCol}>
        <p style={{ ...sectionLabel, textAlign: "left" }}>{label}</p>
        <h3 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>
          {title}
        </h3>
        <p style={{ fontSize: "0.92rem", color: "var(--text-muted)", lineHeight: 1.7 }}>
          {description}
        </p>
      </div>
      <div style={vizCol}>{visual}</div>
    </div>
  );
}

/* ── Live Event Stream visual ────────────────────────── */

function LiveEventStream() {
  const events = [
    { agent: "PM", color: "#a78bfa", text: "Analyzing requirements...", time: "0s" },
    { agent: "Dev", color: "#34d399", text: "Generating auth module", time: "2s" },
    { agent: "Dev", color: "#34d399", text: "Writing tests for login", time: "4s" },
    { agent: "QA", color: "#facc15", text: "Running 24 test cases", time: "6s" },
    { agent: "QA", color: "#facc15", text: "All tests passing", time: "8s" },
    { agent: "DevOps", color: "#f97316", text: "Building Docker image", time: "10s" },
    { agent: "DevOps", color: "#f97316", text: "Deployed to staging", time: "12s" },
  ];

  const [count, setCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCount((c) => {
        if (c >= events.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return c;
        }
        return c + 1;
      });
    }, 700);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [events.length]);

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid var(--glass-border)",
        background: "var(--surface-raised)",
        padding: "1rem",
        maxHeight: 320,
        overflow: "hidden",
        fontFamily: "var(--font-mono)",
      }}
    >
      {events.slice(0, count).map((ev, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.4rem 0.5rem",
            borderRadius: 6,
            animation: "landing-fade-up 0.25s ease-out both",
            marginBottom: 2,
          }}
        >
          <span style={{ fontSize: "0.6rem", color: "var(--text-muted)", minWidth: 24, flexShrink: 0 }}>{ev.time}</span>
          <span
            style={{
              fontSize: "0.6rem",
              fontWeight: 700,
              color: ev.color,
              background: `${ev.color}12`,
              padding: "0.1rem 0.35rem",
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            {ev.agent}
          </span>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{ev.text}</span>
        </div>
      ))}
      {count < events.length && (
        <div style={{ display: "flex", gap: "0.3rem", padding: "0.4rem 0.5rem" }}>
          {[0, 1, 2].map((d) => (
            <div
              key={d}
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "var(--text-muted)",
                animation: "dot-bounce 1s ease-in-out infinite",
                animationDelay: `${d * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Agent templates visual ──────────────────────────── */

function AgentTemplates() {
  const templates = [
    { name: "Product Manager", color: "#a78bfa", tools: ["Spec", "Research"], video: `${PICSART_CDN}/c5d7d947-756b-4da6-bf6d-f5b3a830736c.mp4` },
    { name: "Frontend Dev", color: "#34d399", tools: ["React", "TypeScript"], video: `${PICSART_CDN}/7aab607b-d861-44d3-b5e0-d0233be39ff6.mp4` },
    { name: "QA Engineer", color: "#facc15", tools: ["Jest", "E2E"], video: `${PICSART_CDN}/71fd37ab-de45-474e-89ce-edc39a060935.mp4` },
    { name: "DevOps", color: "#f97316", tools: ["Docker", "CI/CD"], video: `${PICSART_CDN}/254781f4-6575-4cea-b2ac-18ad2e2fc7ca.mp4` },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
      {templates.map((t) => (
        <TemplateCard key={t.name} template={t} />
      ))}
    </div>
  );
}

function TemplateCard({ template }: { template: { name: string; color: string; tools: string[]; video: string } }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = 0.7; }, []);

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid var(--glass-border)",
        background: "var(--surface-raised)",
        padding: "1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.65rem",
        transition: "all 0.2s",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${template.color}40`;
        e.currentTarget.style.boxShadow = `0 0 20px ${template.color}10`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--glass-border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          overflow: "hidden",
          border: `1px solid ${template.color}30`,
          flexShrink: 0,
        }}
      >
        <video ref={videoRef} src={template.video} autoPlay loop muted playsInline style={{ width: 46, height: 46, objectFit: "cover", marginLeft: -4, marginTop: -4 }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)" }}>{template.name}</div>
        <div style={{ display: "flex", gap: "0.3rem", marginTop: 3 }}>
          {template.tools.map((tool) => (
            <span
              key={tool}
              style={{
                fontSize: "0.58rem",
                padding: "0.1rem 0.35rem",
                borderRadius: 4,
                background: `${template.color}12`,
                color: template.color,
                fontWeight: 500,
              }}
            >
              {tool}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Pipeline visual ─────────────────────────────────── */

function PipelineVisual() {
  const phases = [
    { agents: [{ name: "PM", color: "#a78bfa" }], label: "Plan" },
    { agents: [{ name: "Dev", color: "#34d399" }], label: "Build" },
    { agents: [{ name: "QA", color: "#facc15" }], label: "Test" },
    { agents: [{ name: "DevOps", color: "#f97316" }], label: "Deploy" },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, justifyContent: "center" }}>
      {phases.map((phase, i) => (
        <div key={phase.label} style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: `${phase.agents[0].color}12`,
                border: `1.5px solid ${phase.agents[0].color}35`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: phase.agents[0].color,
              }}
            >
              {phase.agents[0].name}
            </div>
            <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontWeight: 500 }}>{phase.label}</span>
          </div>
          {i < phases.length - 1 && (
            <div style={{ width: 40, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <svg width={40} height={12} viewBox="0 0 40 12">
                <line x1="0" y1="6" x2="32" y2="6" stroke="var(--glass-border)" strokeWidth="1.5" strokeDasharray="3 2">
                  <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1s" repeatCount="indefinite" />
                </line>
                <polygon points="30,2 38,6 30,10" fill="var(--glass-border)" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Decorative pipeline flow (like the real app) ───── */

const FLOW_CDN = "https://cdn-cms-uploads.picsart.com/cms-uploads";

const flowAgents = [
  { id: "orch", label: "Orchestrator", color: "#22c55e", video: `${FLOW_CDN}/70483c73-3cd7-428f-ab17-95a56f4343d4.mp4`, status: "idle" as const },
  { id: "pm", label: "Product Manager", color: "#a78bfa", video: `${FLOW_CDN}/c5d7d947-756b-4da6-bf6d-f5b3a830736c.mp4`, status: "complete" as const, text: "I have created the following tasks to address the codebase...", badge: "3 tasks" },
  { id: "dev", label: "Frontend Developer", color: "#34d399", video: `${FLOW_CDN}/7aab607b-d861-44d3-b5e0-d0233be39ff6.mp4`, status: "complete" as const, text: "To efficiently proceed with the refactoring tasks, I'll first need to..." },
  { id: "qa", label: "QA", color: "#facc15", video: `${FLOW_CDN}/71fd37ab-de45-474e-89ce-edc39a060935.mp4`, status: "working" as const },
  { id: "devops", label: "DevOps", color: "#f97316", video: `${FLOW_CDN}/254781f4-6575-4cea-b2ac-18ad2e2fc7ca.mp4`, status: "working" as const },
];

function FlowAvatar({ video, size, color }: { video: string; size: number; color: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.playbackRate = 0.7; }, []);
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: size * 0.3,
      overflow: "hidden",
      border: `2px solid ${color}60`,
      flexShrink: 0,
    }}>
      <video ref={ref} src={video} autoPlay loop muted playsInline
        style={{ width: size * 1.2, height: size * 1.2, objectFit: "cover", marginLeft: -size * 0.1, marginTop: -size * 0.1 }} />
    </div>
  );
}

function FlowCard({ agent }: { agent: typeof flowAgents[number] }) {
  const isComplete = agent.status === "complete";
  const isWorking = agent.status === "working";
  const borderColor = isComplete ? `${agent.color}60` : isWorking ? `${agent.color}80` : `${agent.color}30`;
  const glowColor = isWorking ? `0 0 16px ${agent.color}20` : "none";
  const text = (agent as { text?: string }).text;
  const badge = (agent as { badge?: string }).badge;

  return (
    <div style={{
      background: "var(--surface-raised)",
      border: `1.5px solid ${borderColor}`,
      borderRadius: 14,
      padding: "0.75rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.5rem",
      width: isComplete ? 170 : 148,
      boxShadow: glowColor,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <FlowAvatar video={agent.video} size={32} color={agent.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text)" }}>{agent.label}</div>
          <div style={{
            fontSize: "0.58rem",
            fontWeight: 700,
            color: agent.color,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            {isComplete ? "COMPLETE" : "WORKING..."}
          </div>
        </div>
        {isComplete && (
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" fill={`${agent.color}20`} stroke={agent.color} strokeWidth="1.5" />
            <polyline points="5,8 7.2,10 11,5.5" stroke={agent.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        )}
      </div>
      {/* Body text */}
      {text && (
        <div style={{ fontSize: "0.62rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
          {text}
        </div>
      )}
      {badge && (
        <span style={{
          alignSelf: "flex-start",
          fontSize: "0.55rem",
          fontWeight: 600,
          padding: "0.15rem 0.4rem",
          borderRadius: 6,
          border: `1px solid ${agent.color}30`,
          color: agent.color,
        }}>
          {badge}
        </span>
      )}
      {/* Working dots */}
      {isWorking && (
        <div style={{ display: "flex", gap: 4, paddingTop: 2 }}>
          {[0, 1, 2].map((d) => (
            <div key={d} style={{
              width: 5, height: 5, borderRadius: "50%", background: agent.color,
              animation: "landing-fade-up 0.8s ease-in-out infinite alternate",
              animationDelay: `${d * 0.2}s`,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

function DecorativePipelineFlow() {
  const orch = flowAgents[0];
  const pm = flowAgents[1];
  const dev = flowAgents[2];
  const qa = flowAgents[3];
  const devops = flowAgents[4];

  const connStyle = (color: string, dashed: boolean): CSSProperties => ({
    stroke: color,
    strokeWidth: 2,
    strokeDasharray: dashed ? "6 4" : "none",
    fill: "none",
  });

  return (
    <div style={{
      position: "relative",
      width: 700,
      height: 340,
      borderRadius: 16,
      transform: "scale(0.75)",
      transformOrigin: "top left",
      marginBottom: -85,
      marginRight: -175,
    }}>
      {/* Orchestrator node (small) */}
      <div style={{ position: "absolute", left: 0, top: 145 }}>
        <FlowAvatar video={orch.video} size={40} color={orch.color} />
      </div>

      {/* Connection: Orch → PM */}
      <svg style={{ position: "absolute", left: 40, top: 164, width: 44, height: 2, overflow: "visible" }}>
        <line x1="0" y1="0" x2="44" y2="0" style={connStyle("#a78bfa", false)}>
          <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1s" repeatCount="indefinite" />
        </line>
      </svg>

      {/* PM card */}
      <div style={{ position: "absolute", left: 84, top: 96 }}>
        <FlowCard agent={pm} />
      </div>

      {/* Connection: PM → Dev */}
      <svg style={{ position: "absolute", left: 254, top: 164, width: 38, height: 2, overflow: "visible" }}>
        <line x1="0" y1="0" x2="38" y2="0" style={connStyle("#34d399", false)}>
          <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1s" repeatCount="indefinite" />
        </line>
        <circle cx="0" cy="0" r="3" fill="#34d399" opacity="0.6" />
        <circle cx="38" cy="0" r="3" fill="#34d399" opacity="0.6" />
      </svg>

      {/* Dev card */}
      <div style={{ position: "absolute", left: 292, top: 96 }}>
        <FlowCard agent={dev} />
      </div>

      {/* Connection: Dev → QA (dashed, going up-right) */}
      <svg style={{ position: "absolute", left: 462, top: 24, width: 70, height: 144, overflow: "visible" }}>
        <path d={`M0,120 C25,120 45,10 70,10`} style={connStyle("#facc15", true)}>
          <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="0.8s" repeatCount="indefinite" />
        </path>
        <circle cx="0" cy="120" r="3" fill="#facc15" opacity="0.6" />
      </svg>

      {/* QA card */}
      <div style={{ position: "absolute", left: 532, top: 8 }}>
        <FlowCard agent={qa} />
      </div>

      {/* Connection: Dev → DevOps (dashed, going down-right) */}
      <svg style={{ position: "absolute", left: 462, top: 164, width: 70, height: 120, overflow: "visible" }}>
        <path d={`M0,0 C25,0 45,100 70,100`} style={connStyle("#f97316", true)}>
          <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="0.8s" repeatCount="indefinite" />
        </path>
        <circle cx="0" cy="0" r="3" fill="#f97316" opacity="0.6" />
      </svg>

      {/* DevOps card */}
      <div style={{ position: "absolute", left: 532, top: 232 }}>
        <FlowCard agent={devops} />
      </div>
    </div>
  );
}

/* ── Export ───────────────────────────────────────────── */

export function FeaturesSection() {
  return (
    <section id="how-it-works" style={section}>
      {/* Header with decorative flow */}
      <div style={{ display: "flex", alignItems: "center", gap: "3.5rem", maxWidth: 960, width: "100%", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 400px", minWidth: 340, overflow: "hidden" }}>
          <DecorativePipelineFlow />
        </div>
        <div style={{ flex: "1 1 300px", minWidth: 260 }}>
          <p style={{ ...sectionLabel, textAlign: "left" }}>How it works</p>
          <h2 style={{ ...sectionTitle, textAlign: "left", marginBottom: "0.75rem" }}>Agents that actually ship</h2>
          <p style={{ fontSize: "0.92rem", color: "var(--text-muted)", lineHeight: 1.7, maxWidth: 360 }}>
            A structured pipeline where each agent completes its phase before handing off — from planning to deployment, fully automated.
          </p>
        </div>
      </div>

      <FeatureRow
        label="Real-time"
        title="Watch every step as it happens"
        description="Server-sent events stream every tool call, every decision, every line of code as your agents work. Debug in real-time or just watch — it's weirdly satisfying."
        visual={<LiveEventStream />}
      />

      <FeatureRow
        label="Pipeline"
        title="Orchestrated in phases"
        description="Agents execute in a structured pipeline: Plan, Build, Test, Deploy. Each phase completes before the next begins, with full dependency tracking."
        visual={<PipelineVisual />}
        reversed
      />

      <FeatureRow
        label="Templates"
        title="Pre-configured agent roles"
        description="Launch agents from battle-tested templates. Each role comes with specialized prompts, tool access, and domain expertise baked in."
        visual={<AgentTemplates />}
      />
    </section>
  );
}
