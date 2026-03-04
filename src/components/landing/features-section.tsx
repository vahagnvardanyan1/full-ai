"use client";

import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";

const PICSART_CDN = "https://cdn-cms-uploads.picsart.com/cms-uploads";

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
  return (
    <div
      className="landing-feature-row flex items-center gap-16 max-w-[960px] w-full flex-wrap"
      style={{ flexDirection: reversed ? "row-reverse" : "row" }}
    >
      <div className="landing-feature-text flex-[1_1_300px] min-w-[280px]">
        <p className="text-[0.72rem] font-semibold text-[var(--text-muted)] uppercase tracking-[0.12em] mb-2 text-left">{label}</p>
        <h3 className="text-2xl font-bold text-[var(--text)] tracking-[-0.02em] mb-3">
          {title}
        </h3>
        <p className="text-[0.92rem] text-[var(--text-muted)] leading-[1.7]">
          {description}
        </p>
      </div>
      <div className="landing-feature-visual flex-[1_1_440px] min-w-[340px]">{visual}</div>
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
    <div className="rounded-[14px] border border-[var(--glass-border)] bg-[var(--surface-raised)] p-4 max-h-[320px] overflow-hidden font-mono">
      {events.slice(0, count).map((ev, i) => (
        <div
          key={i}
          className="flex items-center gap-[0.6rem] px-2 py-[0.4rem] rounded-md animate-landing-fade-up mb-0.5"
        >
          <span className="text-[0.6rem] text-[var(--text-muted)] min-w-[24px] shrink-0">{ev.time}</span>
          <span
            className="text-[0.6rem] font-bold px-[0.35rem] py-[0.1rem] rounded shrink-0"
            style={{ color: ev.color, background: `${ev.color}12` }}
          >
            {ev.agent}
          </span>
          <span className="text-[0.7rem] text-[var(--text-muted)]">{ev.text}</span>
        </div>
      ))}
      {count < events.length && (
        <div className="flex gap-[0.3rem] px-2 py-[0.4rem]">
          {[0, 1, 2].map((d) => (
            <div
              key={d}
              className="size-1 rounded-full bg-[var(--text-muted)]"
              style={{
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
    <div className="grid grid-cols-2 gap-3">
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
      className="rounded-xl border border-[var(--glass-border)] bg-[var(--surface-raised)] p-4 flex items-center gap-[0.65rem] transition-all duration-200 cursor-default hover:shadow-[0_0_20px_var(--tw-shadow-color)]"
      style={{
        // @ts-expect-error CSS custom property for hover shadow color
        "--tw-shadow-color": `${template.color}10`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${template.color}40`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--glass-border)";
      }}
    >
      <div
        className="size-[38px] rounded-[10px] overflow-hidden shrink-0"
        style={{ border: `1px solid ${template.color}30` }}
      >
        <video ref={videoRef} src={template.video} autoPlay loop muted playsInline className="object-cover" style={{ width: 46, height: 46, marginLeft: -4, marginTop: -4 }} />
      </div>
      <div className="min-w-0">
        <div className="text-[0.78rem] font-semibold text-[var(--text)]">{template.name}</div>
        <div className="flex gap-[0.3rem] mt-[3px]">
          {template.tools.map((tool) => (
            <span
              key={tool}
              className="text-[0.58rem] px-[0.35rem] py-[0.1rem] rounded font-medium"
              style={{ background: `${template.color}12`, color: template.color }}
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
    <div className="flex items-center gap-0 justify-center">
      {phases.map((phase, i) => (
        <div key={phase.label} className="flex items-center">
          <div className="flex flex-col items-center gap-[0.35rem]">
            <div
              className="size-12 rounded-xl flex items-center justify-center text-[0.75rem] font-bold"
              style={{
                background: `${phase.agents[0].color}12`,
                border: `1.5px solid ${phase.agents[0].color}35`,
                color: phase.agents[0].color,
              }}
            >
              {phase.agents[0].name}
            </div>
            <span className="text-[0.62rem] text-[var(--text-muted)] font-medium">{phase.label}</span>
          </div>
          {i < phases.length - 1 && (
            <div className="w-10 flex items-center justify-center mb-4">
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
    <div
      className="overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        border: `2px solid ${color}60`,
      }}
    >
      <video ref={ref} src={video} autoPlay loop muted playsInline
        className="object-cover"
        style={{ width: size * 1.2, height: size * 1.2, marginLeft: -size * 0.1, marginTop: -size * 0.1 }} />
    </div>
  );
}

function FlowCard({ agent }: { agent: typeof flowAgents[number] }) {
  const isComplete = agent.status === "complete";
  const isWorking = agent.status === "working";
  const borderColor = isComplete ? `${agent.color}60` : isWorking ? `${agent.color}80` : `${agent.color}30`;
  const glowShadow = isWorking ? `0 0 16px ${agent.color}20` : "none";
  const text = (agent as { text?: string }).text;
  const badge = (agent as { badge?: string }).badge;

  return (
    <div
      className="bg-[var(--surface-raised)] rounded-[14px] p-3 flex flex-col gap-2"
      style={{
        border: `1.5px solid ${borderColor}`,
        width: isComplete ? 170 : 148,
        boxShadow: glowShadow,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <FlowAvatar video={agent.video} size={32} color={agent.color} />
        <div className="flex-1 min-w-0">
          <div className="text-[0.72rem] font-bold text-[var(--text)]">{agent.label}</div>
          <div
            className="text-[0.58rem] font-bold uppercase tracking-[0.05em]"
            style={{ color: agent.color }}
          >
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
        <div className="text-[0.62rem] text-[var(--text-muted)] leading-[1.4]">{text}</div>
      )}
      {badge && (
        <span
          className="self-start text-[0.55rem] font-semibold px-[0.4rem] py-[0.15rem] rounded-md"
          style={{ border: `1px solid ${agent.color}30`, color: agent.color }}
        >
          {badge}
        </span>
      )}
      {/* Working dots */}
      {isWorking && (
        <div className="flex gap-1 pt-0.5">
          {[0, 1, 2].map((d) => (
            <div
              key={d}
              className="size-[5px] rounded-full"
              style={{
                background: agent.color,
                animation: "landing-fade-up 0.8s ease-in-out infinite alternate",
                animationDelay: `${d * 0.2}s`,
              }}
            />
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
    <div
      className="landing-pipeline-flow relative rounded-2xl"
      style={{
        width: 700,
        height: 340,
        transform: "scale(0.75)",
        transformOrigin: "top left",
        marginBottom: -85,
        marginRight: -175,
      }}
    >
      {/* Orchestrator node (small) */}
      <div className="absolute" style={{ left: 0, top: 145 }}>
        <FlowAvatar video={orch.video} size={40} color={orch.color} />
      </div>

      {/* Connection: Orch → PM */}
      <svg className="absolute overflow-visible" style={{ left: 40, top: 164, width: 44, height: 2 }}>
        <line x1="0" y1="0" x2="44" y2="0" style={connStyle("#a78bfa", false)}>
          <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1s" repeatCount="indefinite" />
        </line>
      </svg>

      {/* PM card */}
      <div className="absolute" style={{ left: 84, top: 96 }}>
        <FlowCard agent={pm} />
      </div>

      {/* Connection: PM → Dev */}
      <svg className="absolute overflow-visible" style={{ left: 254, top: 164, width: 38, height: 2 }}>
        <line x1="0" y1="0" x2="38" y2="0" style={connStyle("#34d399", false)}>
          <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1s" repeatCount="indefinite" />
        </line>
        <circle cx="0" cy="0" r="3" fill="#34d399" opacity="0.6" />
        <circle cx="38" cy="0" r="3" fill="#34d399" opacity="0.6" />
      </svg>

      {/* Dev card */}
      <div className="absolute" style={{ left: 292, top: 96 }}>
        <FlowCard agent={dev} />
      </div>

      {/* Connection: Dev → QA (dashed, going up-right) */}
      <svg className="absolute overflow-visible" style={{ left: 462, top: 24, width: 70, height: 144 }}>
        <path d={`M0,120 C25,120 45,10 70,10`} style={connStyle("#facc15", true)}>
          <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="0.8s" repeatCount="indefinite" />
        </path>
        <circle cx="0" cy="120" r="3" fill="#facc15" opacity="0.6" />
      </svg>

      {/* QA card */}
      <div className="absolute" style={{ left: 532, top: 8 }}>
        <FlowCard agent={qa} />
      </div>

      {/* Connection: Dev → DevOps (dashed, going down-right) */}
      <svg className="absolute overflow-visible" style={{ left: 462, top: 164, width: 70, height: 120 }}>
        <path d={`M0,0 C25,0 45,100 70,100`} style={connStyle("#f97316", true)}>
          <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="0.8s" repeatCount="indefinite" />
        </path>
        <circle cx="0" cy="0" r="3" fill="#f97316" opacity="0.6" />
      </svg>

      {/* DevOps card */}
      <div className="absolute" style={{ left: 532, top: 232 }}>
        <FlowCard agent={devops} />
      </div>
    </div>
  );
}

/* ── Export ───────────────────────────────────────────── */

export function FeaturesSection() {
  return (
    <section id="how-it-works" className="landing-features-section px-6 py-20 flex flex-col items-center gap-20">
      {/* Header with decorative flow */}
      <div className="landing-features-header flex items-center gap-14 max-w-[960px] w-full flex-wrap">
        <div className="landing-feature-visual flex-[1_1_400px] min-w-[340px] overflow-hidden">
          <DecorativePipelineFlow />
        </div>
        <div className="landing-feature-text flex-[1_1_300px] min-w-[260px]">
          <p className="text-[0.72rem] font-semibold text-[var(--text-muted)] uppercase tracking-[0.12em] mb-2 text-left">How it works</p>
          <h2 className="font-bold font-[var(--font-display)] text-[var(--text)] text-left tracking-[-0.025em] mb-3" style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.5rem)" }}>Agents actually ship</h2>
          <p className="text-[0.92rem] text-[var(--text-muted)] leading-[1.7] max-w-[360px]">
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
