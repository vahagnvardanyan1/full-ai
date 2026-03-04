"use client";

import { useEffect, useState, useRef } from "react";

/* ── Provider data ──────────────────────────────────── */

const PROVIDERS = [
  {
    name: "Claude",
    model: "Opus 4.6",
    color: "#D97757",
    icon: (
      <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L9.5 7.5 4 10l5.5 2.5L12 18l2.5-5.5L20 10l-5.5-2.5z" />
      </svg>
    ),
  },
  {
    name: "OpenAI",
    model: "GPT-4o",
    color: "#10a37f",
    icon: (
      <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
      </svg>
    ),
  },
  {
    name: "Gemini",
    model: "2.0 Pro",
    color: "#4285F4",
    icon: (
      <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm0 3.6c2.34 0 4.422.966 5.94 2.46L12 12 6.06 6.06A8.36 8.36 0 0 1 12 3.6zm-8.4 8.4c0-2.34.966-4.422 2.46-5.94L12 12l-5.94 5.94A8.36 8.36 0 0 1 3.6 12zm8.4 8.4a8.36 8.36 0 0 1-5.94-2.46L12 12l5.94 5.94A8.36 8.36 0 0 1 12 20.4zm5.94-2.46L12 12l5.94-5.94A8.36 8.36 0 0 1 20.4 12a8.36 8.36 0 0 1-2.46 5.94z" />
      </svg>
    ),
  },
];

const ROUTING_EVENTS = [
  { task: "Analyzing product spec", provider: 0, latency: "1.2s", reason: "Deep reasoning" },
  { task: "Generating React components", provider: 1, latency: "0.8s", reason: "Fast code gen" },
  { task: "Writing E2E test suite", provider: 0, latency: "1.4s", reason: "Complex logic" },
  { task: "Parsing image mockup", provider: 2, latency: "0.6s", reason: "Multimodal" },
  { task: "Drafting API documentation", provider: 1, latency: "0.5s", reason: "Speed optimized" },
  { task: "Reviewing security audit", provider: 0, latency: "1.8s", reason: "Deep analysis" },
];

/* ── Orbiting circles ───────────────────────────────── */

const ORBIT_RADIUS = 130;
const ORBIT_SIZE = 340;
const ORBIT_CENTER = ORBIT_SIZE / 2;

const toXY = (angleDeg: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: ORBIT_CENTER + Math.cos(rad) * ORBIT_RADIUS,
    y: ORBIT_CENTER + Math.sin(rad) * ORBIT_RADIUS,
  };
};

function OrbitingProviders() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [angles, setAngles] = useState([-90, 30, 150]);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingIdx = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(
      () => setActiveIdx((i) => (i + 1) % PROVIDERS.length),
      2500,
    );
    return () => clearInterval(timer);
  }, []);

  const getAngleFromPointer = (clientX: number, clientY: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  };

  const handlePointerDown =
    (idx: number) => (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      draggingIdx.current = idx;
      e.currentTarget.setPointerCapture(e.pointerId);
    };

  const handlePointerMove =
    (idx: number) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (draggingIdx.current !== idx) return;
      const angle = getAngleFromPointer(e.clientX, e.clientY);
      setAngles((prev) => {
        const next = [...prev];
        next[idx] = angle;
        return next;
      });
    };

  const handlePointerUp =
    (idx: number) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (draggingIdx.current === idx) {
        draggingIdx.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    };

  return (
    <div
      ref={containerRef}
      className="landing-orbit relative shrink-0"
      style={{ width: ORBIT_SIZE, height: ORBIT_SIZE }}
    >
      {/* Orbit ring */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--glass-border)]"
        style={{ width: ORBIT_RADIUS * 2, height: ORBIT_RADIUS * 2 }}
      />

      {/* Center hub */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[76px] h-[76px] rounded-[18px] bg-[var(--surface-raised)] border border-[var(--glass-border)] flex flex-col items-center justify-center gap-[3px] z-[2]">
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        <span className="text-[0.58rem] font-bold text-[var(--text-muted)] tracking-[0.05em]">AUTO</span>
      </div>

      {/* Provider nodes */}
      {PROVIDERS.map((p, i) => {
        const { x, y } = toXY(angles[i]);
        const isActive = i === activeIdx;

        return (
          <div key={p.name} className="absolute">
            {/* Connection line to center */}
            <svg
              className="absolute top-0 left-0 pointer-events-none"
              style={{ width: ORBIT_SIZE, height: ORBIT_SIZE }}
              viewBox={`0 0 ${ORBIT_SIZE} ${ORBIT_SIZE}`}
            >
              <line
                x1={ORBIT_CENTER}
                y1={ORBIT_CENTER}
                x2={x}
                y2={y}
                stroke={isActive ? p.color : "var(--glass-border)"}
                strokeWidth={isActive ? 2 : 1}
                strokeDasharray={isActive ? "6 4" : "3 3"}
                opacity={isActive ? 0.8 : 0.3}
                style={{ transition: "stroke 0.5s ease, opacity 0.5s ease" }}
              >
                {isActive && (
                  <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="0.8s" repeatCount="indefinite" />
                )}
              </line>
            </svg>

            {/* Draggable node */}
            <div
              onPointerDown={handlePointerDown(i)}
              onPointerMove={handlePointerMove(i)}
              onPointerUp={handlePointerUp(i)}
              onClick={() => setActiveIdx(i)}
              className="absolute size-[54px] rounded-[14px] flex items-center justify-center z-[3] cursor-grab touch-none select-none"
              style={{
                left: x - 27,
                top: y - 27,
                background: isActive ? `${p.color}15` : "var(--surface-raised)",
                border: isActive ? `1.5px solid ${p.color}50` : "1px solid var(--glass-border)",
                color: isActive ? p.color : "var(--text-muted)",
                transition: "background 0.5s ease, border 0.5s ease, box-shadow 0.5s ease, color 0.5s ease",
                boxShadow: isActive ? `0 0 24px ${p.color}20` : "none",
              }}
            >
              {p.icon}
            </div>

            {/* Label */}
            <span
              className="absolute w-[60px] text-center text-[0.7rem] font-semibold pointer-events-none select-none"
              style={{
                left: x - 30,
                top: y + 32,
                color: isActive ? "var(--text)" : "var(--text-muted)",
                transition: "color 0.5s ease",
              }}
            >
              {p.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Live routing ticker ────────────────────────────── */

function RoutingTicker() {
  const [visibleCount, setVisibleCount] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleCount((c) => (c >= ROUTING_EVENTS.length ? 1 : c + 1));
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [visibleCount]);

  const events = ROUTING_EVENTS.slice(0, visibleCount);

  return (
    <div
      ref={containerRef}
      className="landing-ticker flex-1 min-w-[340px] max-h-[360px] overflow-hidden rounded-[14px] border border-[var(--glass-border)] bg-[var(--surface-raised)] p-3 font-mono"
    >
      {/* Header */}
      <div className="flex items-center gap-2 pb-[0.6rem] mb-2 border-b border-[var(--glass-border)]">
        <span className="size-1.5 rounded-full bg-[#22c55e]" style={{ animation: "landing-fade-up 1.5s ease-in-out infinite alternate" }} />
        <span className="text-[0.62rem] font-bold text-[var(--text-muted)] uppercase tracking-[0.08em]">
          Smart routing — live
        </span>
      </div>

      {/* Events */}
      {events.map((ev, i) => {
        const p = PROVIDERS[ev.provider] ?? PROVIDERS[0];
        return (
          <div
            key={`${ev.task}-${i}`}
            className="flex items-start gap-2 py-[0.55rem] animate-landing-fade-up"
            style={{ borderBottom: i < events.length - 1 ? "1px solid var(--glass-border)" : "none" }}
          >
            {/* Provider badge */}
            <div
              className="size-[34px] rounded-[9px] flex items-center justify-center shrink-0 mt-px"
              style={{
                background: `${p.color}12`,
                border: `1px solid ${p.color}20`,
                color: p.color,
              }}
            >
              {p.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-[0.78rem] text-[var(--text)] font-medium font-[var(--font-body)]">
                {ev.task}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[0.58rem] font-semibold" style={{ color: p.color }}>{p.model}</span>
                <span className="text-[0.55rem] text-[var(--text-muted)]">{ev.latency}</span>
                <span
                  className="text-[0.52rem] px-[0.3rem] py-[0.08rem] rounded font-medium font-[var(--font-body)]"
                  style={{ background: `${p.color}10`, color: p.color }}
                >
                  {ev.reason}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Typing indicator */}
      <div className="flex gap-1 pt-2 pb-[0.2rem] items-center">
        {[0, 1, 2].map((d) => (
          <div
            key={d}
            className="size-[3px] rounded-full bg-[var(--text-muted)]"
            style={{
              animation: "landing-fade-up 0.8s ease-in-out infinite alternate",
              animationDelay: `${d * 0.15}s`,
            }}
          />
        ))}
        <span className="text-[0.55rem] text-[var(--text-muted)] ml-[0.3rem]">
          routing next task...
        </span>
      </div>
    </div>
  );
}

/* ── Stats row ──────────────────────────────────────── */

function StatsRow() {
  const stats = [
    { value: "3+", label: "AI Providers" },
    { value: "Auto", label: "Model routing" },
    { value: "<2s", label: "Avg. response" },
  ];

  return (
    <div className="landing-stats-row flex gap-8 justify-center flex-wrap mt-6">
      {stats.map((s) => (
        <div key={s.label} className="text-center">
          <div className="text-[1.8rem] font-extrabold font-[var(--font-display)] text-[var(--text)] tracking-[-0.02em]">
            {s.value}
          </div>
          <div className="text-[0.68rem] text-[var(--text-muted)] font-medium mt-0.5">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Export ──────────────────────────────────────────── */

export function AiProviders() {
  return (
    <section className="landing-ai-section px-6 py-20 flex flex-col items-center">
      <p className="text-[0.72rem] font-semibold text-[var(--text-muted)] uppercase tracking-[0.12em] mb-2">Intelligent model routing</p>
      <h2 className="font-bold font-[var(--font-display)] text-[var(--text)] text-center tracking-[-0.025em] mb-3" style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.5rem)" }}>The right model, every time</h2>
      <p className="text-[0.92rem] text-[var(--text-muted)] text-center leading-relaxed max-w-[480px] mb-8">
        We analyze each task and automatically dispatch to the most capable
        model — so you get the best results without thinking about it.
      </p>

      <div className="landing-ai-layout flex gap-10 items-center justify-center flex-wrap max-w-[960px] w-full">
        <OrbitingProviders />
        <RoutingTicker />
      </div>

      <StatsRow />
    </section>
  );
}
