"use client";

import { CSSProperties, useEffect, useState, useRef } from "react";

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
  {
    task: "Analyzing product spec",
    provider: 0,
    latency: "1.2s",
    reason: "Deep reasoning",
  },
  {
    task: "Generating React components",
    provider: 1,
    latency: "0.8s",
    reason: "Fast code gen",
  },
  {
    task: "Writing E2E test suite",
    provider: 0,
    latency: "1.4s",
    reason: "Complex logic",
  },
  {
    task: "Parsing image mockup",
    provider: 2,
    latency: "0.6s",
    reason: "Multimodal",
  },
  {
    task: "Drafting API documentation",
    provider: 1,
    latency: "0.5s",
    reason: "Speed optimized",
  },
  {
    task: "Reviewing security audit",
    provider: 0,
    latency: "1.8s",
    reason: "Deep analysis",
  },
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
      style={{
        position: "relative",
        width: ORBIT_SIZE,
        height: ORBIT_SIZE,
        flexShrink: 0,
      }}
    >
      {/* Orbit ring */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: ORBIT_RADIUS * 2,
          height: ORBIT_RADIUS * 2,
          borderRadius: "50%",
          border: "1px solid var(--glass-border)",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Center hub */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 76,
          height: 76,
          borderRadius: 18,
          background: "var(--surface-raised)",
          border: "1px solid var(--glass-border)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          zIndex: 2,
        }}
      >
        <svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text)"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        <span
          style={{
            fontSize: "0.58rem",
            fontWeight: 700,
            color: "var(--text-muted)",
            letterSpacing: "0.05em",
          }}
        >
          AUTO
        </span>
      </div>

      {/* Provider nodes */}
      {PROVIDERS.map((p, i) => {
        const { x, y } = toXY(angles[i]);
        const isActive = i === activeIdx;

        return (
          <div key={p.name} style={{ position: "absolute" }}>
            {/* Connection line to center */}
            <svg
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: ORBIT_SIZE,
                height: ORBIT_SIZE,
                pointerEvents: "none",
              }}
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
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="-20"
                    dur="0.8s"
                    repeatCount="indefinite"
                  />
                )}
              </line>
            </svg>

            {/* Draggable node */}
            <div
              onPointerDown={handlePointerDown(i)}
              onPointerMove={handlePointerMove(i)}
              onPointerUp={handlePointerUp(i)}
              onClick={() => setActiveIdx(i)}
              style={{
                position: "absolute",
                left: x - 27,
                top: y - 27,
                width: 54,
                height: 54,
                borderRadius: 14,
                background: isActive ? `${p.color}15` : "var(--surface-raised)",
                border: isActive
                  ? `1.5px solid ${p.color}50`
                  : "1px solid var(--glass-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isActive ? p.color : "var(--text-muted)",
                transition:
                  "background 0.5s ease, border 0.5s ease, box-shadow 0.5s ease, color 0.5s ease",
                boxShadow: isActive ? `0 0 24px ${p.color}20` : "none",
                zIndex: 3,
                cursor: "grab",
                touchAction: "none",
                userSelect: "none",
              }}
            >
              {p.icon}
            </div>

            {/* Label */}
            <span
              style={{
                position: "absolute",
                left: x - 30,
                top: y + 32,
                width: 60,
                textAlign: "center",
                fontSize: "0.7rem",
                fontWeight: 600,
                color: isActive ? "var(--text)" : "var(--text-muted)",
                transition: "color 0.5s ease",
                pointerEvents: "none",
                userSelect: "none",
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
      style={{
        flex: 1,
        minWidth: 340,
        maxHeight: 360,
        overflow: "hidden",
        borderRadius: 14,
        border: "1px solid var(--glass-border)",
        background: "var(--surface-raised)",
        padding: "0.75rem",
        fontFamily: "var(--font-mono)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          paddingBottom: "0.6rem",
          marginBottom: "0.5rem",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#22c55e",
            animation: "landing-fade-up 1.5s ease-in-out infinite alternate",
          }}
        />
        <span
          style={{
            fontSize: "0.62rem",
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Smart routing — live
        </span>
      </div>

      {/* Events */}
      {events.map((ev, i) => {
        const p = PROVIDERS[ev.provider] ?? PROVIDERS[0];
        return (
          <div
            key={`${ev.task}-${i}`}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
              padding: "0.55rem 0",
              borderBottom:
                i < events.length - 1
                  ? "1px solid var(--glass-border)"
                  : "none",
              animation: "landing-fade-up 0.3s ease-out both",
            }}
          >
            {/* Provider badge */}
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: `${p.color}12`,
                border: `1px solid ${p.color}20`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: p.color,
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              {p.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text)",
                  fontWeight: 500,
                  fontFamily: "var(--font-body)",
                }}
              >
                {ev.task}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginTop: 2,
                }}
              >
                <span
                  style={{
                    fontSize: "0.58rem",
                    fontWeight: 600,
                    color: p.color,
                  }}
                >
                  {p.model}
                </span>
                <span
                  style={{ fontSize: "0.55rem", color: "var(--text-muted)" }}
                >
                  {ev.latency}
                </span>
                <span
                  style={{
                    fontSize: "0.52rem",
                    padding: "0.08rem 0.3rem",
                    borderRadius: 4,
                    background: `${p.color}10`,
                    color: p.color,
                    fontWeight: 500,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {ev.reason}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Typing indicator */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          padding: "0.5rem 0 0.2rem",
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((d) => (
          <div
            key={d}
            style={{
              width: 3,
              height: 3,
              borderRadius: "50%",
              background: "var(--text-muted)",
              animation: "landing-fade-up 0.8s ease-in-out infinite alternate",
              animationDelay: `${d * 0.15}s`,
            }}
          />
        ))}
        <span
          style={{
            fontSize: "0.55rem",
            color: "var(--text-muted)",
            marginLeft: "0.3rem",
          }}
        >
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
    <div
      style={{
        display: "flex",
        gap: "2rem",
        justifyContent: "center",
        flexWrap: "wrap",
        marginTop: "1.5rem",
      }}
    >
      {stats.map((s) => (
        <div key={s.label} style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "1.8rem",
              fontWeight: 800,
              fontFamily: "var(--font-display)",
              color: "var(--text)",
              letterSpacing: "-0.02em",
            }}
          >
            {s.value}
          </div>
          <div
            style={{
              fontSize: "0.68rem",
              color: "var(--text-muted)",
              fontWeight: 500,
              marginTop: 2,
            }}
          >
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Section styles ─────────────────────────────────── */

const section: CSSProperties = {
  padding: "3rem 1.5rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const sectionLabel: CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  marginBottom: "0.5rem",
};

const sectionTitle: CSSProperties = {
  fontSize: "clamp(1.5rem, 3.5vw, 2.5rem)",
  fontWeight: 700,
  fontFamily: "var(--font-display)",
  color: "var(--text)",
  textAlign: "center",
  letterSpacing: "-0.025em",
  marginBottom: "0.75rem",
};

const sectionSubtitle: CSSProperties = {
  fontSize: "0.92rem",
  color: "var(--text-muted)",
  textAlign: "center",
  lineHeight: 1.6,
  maxWidth: 480,
  marginBottom: "2rem",
};

/* ── Export ──────────────────────────────────────────── */

export function AiProviders() {
  return (
    <section style={section}>
      <p style={sectionLabel}>Intelligent model routing</p>
      <h2 style={sectionTitle}>The right model, every time</h2>
      <p style={sectionSubtitle}>
        We analyze each task and automatically dispatch to the most capable
        model — so you get the best results without thinking about it.
      </p>

      <div
        style={{
          display: "flex",
          gap: "2.5rem",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          maxWidth: 960,
          width: "100%",
        }}
      >
        <OrbitingProviders />
        <RoutingTicker />
      </div>

      <StatsRow />
    </section>
  );
}
