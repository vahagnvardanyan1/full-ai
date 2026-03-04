"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { CSSProperties } from "react";

// Grid unit: 4px. Robot canvas: 14U × 22U = 56 × 88 px (before scale).
const U = 4;

const MEETING_LINGER_MS = 1600;
const PROXIMITY_PX = 150;

/**
 * Deterministic pseudo-random value in [0, 1] derived from a string seed.
 * Identical on server and client — no hydration mismatch.
 */
const deterministicRandom = (seed: string): number => {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (((h << 5) + h) + seed.charCodeAt(i)) & 0xffffffff;
  }
  return (h >>> 0) / 4294967295;
};

type CharDef = {
  id: string;
  label: string;
  thinking: string | null;
  meetText: string;
  thinkingDelay: string;
  eyeColor: string;
  headColor: string;
  bodyColor: string;
  darkColor: string;
  speed: number;
  topPos: string;
  scale: number;
  opacity: number;
  dir: "ltr" | "rtl";
  waviness: number;  // max Y deviation in px
  waveFreq: number;  // oscillation cycles across one pass
  wavePhase: number; // starting phase (radians)
};

const CHARS: CharDef[] = [
  {
    id: "orch",
    label: "Orchestrator",
    thinking: "ANALYZING...",
    meetText: "HELLO AGENT",
    thinkingDelay: "0s",
    eyeColor: "#0ea5e9",
    headColor: "#152535",
    bodyColor: "#0d1c28",
    darkColor: "#071118",
    speed: 26,
    topPos: "12%",
    scale: 0.72,
    opacity: 0.82,
    dir: "ltr",
    waviness: 42,
    waveFreq: 1.3,
    wavePhase: 0,
  },
  {
    id: "pm",
    label: "PM",
    thinking: "PLANNING...",
    meetText: "NEW SPRINT?",
    thinkingDelay: "2s",
    eyeColor: "#a78bfa",
    headColor: "#1a1230",
    bodyColor: "#120c24",
    darkColor: "#090616",
    speed: 34,
    topPos: "30%",
    scale: 0.54,
    opacity: 0.58,
    dir: "rtl",
    waviness: 60,
    waveFreq: 0.85,
    wavePhase: 1.2,
  },
  {
    id: "dev",
    label: "Dev",
    thinking: "COMPILING...",
    meetText: "PR REVIEW?",
    thinkingDelay: "3.2s",
    eyeColor: "#34d399",
    headColor: "#091e16",
    bodyColor: "#061410",
    darkColor: "#030c09",
    speed: 21,
    topPos: "50%",
    scale: 0.60,
    opacity: 0.62,
    dir: "ltr",
    waviness: 55,
    waveFreq: 1.7,
    wavePhase: 2.1,
  },
  {
    id: "qa",
    label: "QA",
    thinking: "TESTING...",
    meetText: "BUG FOUND!",
    thinkingDelay: "0.8s",
    eyeColor: "#fbbf24",
    headColor: "#1c1700",
    bodyColor: "#141000",
    darkColor: "#0b0900",
    speed: 38,
    topPos: "65%",
    scale: 0.80,
    opacity: 0.9,
    dir: "rtl",
    waviness: 35,
    waveFreq: 2.2,
    wavePhase: 0.7,
  },
  {
    id: "devops",
    label: "DevOps",
    thinking: "DEPLOYING...",
    meetText: "DEPLOY TIME",
    thinkingDelay: "3.8s",
    eyeColor: "#fb923c",
    headColor: "#1c0e00",
    bodyColor: "#130900",
    darkColor: "#0a0500",
    speed: 29,
    topPos: "78%",
    scale: 0.88,
    opacity: 0.95,
    dir: "ltr",
    waviness: 28,
    waveFreq: 1.1,
    wavePhase: 3.5,
  },
  {
    id: "scout",
    label: "Scout",
    thinking: null,
    meetText: "AGENT NEAR!",
    thinkingDelay: "0s",
    eyeColor: "#f472b6",
    headColor: "#1c0810",
    bodyColor: "#13060c",
    darkColor: "#0a0408",
    speed: 23,
    topPos: "40%",
    scale: 0.50,
    opacity: 0.5,
    dir: "ltr",
    waviness: 68,
    waveFreq: 1.55,
    wavePhase: 4.2,
  },
];

/**
 * Builds per-robot CSS keyframe animations with sinusoidal Y oscillation.
 * Uses calc(vw) for X so it's SSR-safe and responsive.
 */
const buildPathKeyframes = (chars: CharDef[]): string => {
  const STEPS = 22;
  return chars
    .map(({ id, dir, waviness, waveFreq, wavePhase }) => {
      let frames = "";
      for (let i = 0; i <= STEPS; i++) {
        const pct = ((i / STEPS) * 100).toFixed(1);
        const t = i / STEPS;
        const xExpr =
          dir === "ltr"
            ? `calc(-160px + (100vw + 320px) * ${t.toFixed(5)})`
            : `calc(100vw + 160px - (100vw + 320px) * ${t.toFixed(5)})`;
        const y = (waviness * Math.sin(waveFreq * t * Math.PI * 2 + wavePhase)).toFixed(1);
        frames += `${pct}%{transform:translateX(${xExpr}) translateY(${y}px);}`;
      }
      return `@keyframes pw-path-${id}{${frames}}`;
    })
    .join("\n");
};

// ── Thinking bubble (periodic fade-in/out during solo walk) ──────────────────

type ThinkingBubbleProps = {
  text: string;
  delay: string;
  color: string;
};

const ThinkingBubble = ({ text, delay, color }: ThinkingBubbleProps) => (
  <div
    className="pixel-thinking"
    style={{
      background: "rgba(4,8,18,0.94)",
      border: `1.5px solid ${color}`,
      borderRadius: 3,
      padding: "2px 8px",
      fontSize: 8,
      fontFamily: "var(--font-mono)",
      fontWeight: 700,
      color,
      whiteSpace: "nowrap",
      letterSpacing: "0.1em",
      position: "relative",
      boxShadow: `0 0 12px ${color}55`,
      animationDelay: delay,
    }}
  >
    {text}
    <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
      width: 0, height: 0, borderLeft: "4px solid transparent",
      borderRight: "4px solid transparent", borderTop: `6px solid ${color}` }} />
    <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
      width: 0, height: 0, borderLeft: "3px solid transparent",
      borderRight: "3px solid transparent", borderTop: "5px solid rgba(4,8,18,0.94)" }} />
  </div>
);

// ── Meeting bubble (always visible, pops in when robots meet) ────────────────

type MeetingBubbleProps = {
  text: string;
  color: string;
};

const MeetingBubble = ({ text, color }: MeetingBubbleProps) => (
  <div
    className="pixel-meeting-pop"
    style={{
      background: "rgba(4,8,18,0.97)",
      border: `2px solid ${color}`,
      borderRadius: 3,
      padding: "3px 9px",
      fontSize: 9,
      fontFamily: "var(--font-mono)",
      fontWeight: 700,
      color,
      whiteSpace: "nowrap",
      letterSpacing: "0.08em",
      position: "relative",
      boxShadow: `0 0 20px ${color}99, 0 0 6px ${color}44 inset`,
    }}
  >
    {text}
    <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
      width: 0, height: 0, borderLeft: "4px solid transparent",
      borderRight: "4px solid transparent", borderTop: `6px solid ${color}` }} />
    <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
      width: 0, height: 0, borderLeft: "3px solid transparent",
      borderRight: "3px solid transparent", borderTop: "5px solid rgba(4,8,18,0.97)" }} />
  </div>
);

// ── Robot SVG pixel art ───────────────────────────────────────────────────────

type RobotSVGProps = {
  id: string;
  eyeColor: string;
  headColor: string;
  bodyColor: string;
  darkColor: string;
  dir: "ltr" | "rtl";
};

const RobotSVG = ({ id, eyeColor, headColor, bodyColor, darkColor, dir }: RobotSVGProps) => {
  const w = 14 * U;
  const h = 22 * U;
  const glow = `url(#pw-glow-${id})`;
  const sGlow = `url(#pw-sglow-${id})`;

  const svgStyle: CSSProperties = {
    overflow: "visible",
    imageRendering: "pixelated",
    ...(dir === "rtl" ? { transform: "scaleX(-1)" } : {}),
  };

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={svgStyle}>
      <defs>
        <filter id={`pw-glow-${id}`} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`pw-sglow-${id}`} x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* ── ANTENNA ── */}
      <rect x={6*U} y={0} width={2*U} height={U} fill={eyeColor} filter={glow} className="pixel-antenna-pulse" />
      <rect x={6.5*U} y={U} width={U} height={U} fill={headColor} />
      <rect x={5*U} y={2*U} width={4*U} height={U} fill={headColor} />

      {/* ── HEAD ── */}
      <rect x={2*U} y={3*U} width={10*U} height={6*U} fill={headColor} />
      {/* top-ridge highlight */}
      <rect x={3*U} y={3*U} width={8*U} height={U} fill="rgba(255,255,255,0.1)" />
      {/* left ear sensor */}
      <rect x={U} y={4*U} width={U} height={4*U} fill={eyeColor} opacity={0.45} />
      <rect x={U} y={4*U} width={U} height={U} fill={eyeColor} opacity={0.9} />
      {/* right ear sensor */}
      <rect x={12*U} y={4*U} width={U} height={4*U} fill={eyeColor} opacity={0.45} />
      <rect x={12*U} y={4*U} width={U} height={U} fill={eyeColor} opacity={0.9} />
      {/* visor shade */}
      <rect x={2*U} y={4*U} width={10*U} height={U} fill={darkColor} opacity={0.8} />
      {/* eye glow halos */}
      <rect x={2*U-1} y={5*U-1} width={4*U+2} height={2*U+2} fill={eyeColor} opacity={0.2} />
      <rect x={8*U-1} y={5*U-1} width={4*U+2} height={2*U+2} fill={eyeColor} opacity={0.2} />
      {/* LED eyes — 4U × 2U each */}
      <rect x={2*U} y={5*U} width={4*U} height={2*U} fill={eyeColor} filter={glow} className="pixel-eye-glow" />
      <rect x={8*U} y={5*U} width={4*U} height={2*U} fill={eyeColor} filter={glow} className="pixel-eye-glow" />
      {/* scanline effect */}
      <rect x={2*U} y={6*U} width={4*U} height={2} fill={darkColor} opacity={0.35} />
      <rect x={8*U} y={6*U} width={4*U} height={2} fill={darkColor} opacity={0.35} />
      {/* nose bridge */}
      <rect x={6*U} y={5*U} width={2*U} height={2*U} fill={headColor} />
      {/* mouth grill */}
      <rect x={3*U} y={7.5*U} width={8*U} height={1.5*U} fill={darkColor} />
      <rect x={3.8*U} y={7.5*U} width={2} height={1.5*U} fill={headColor} opacity={0.4} />
      <rect x={5.2*U} y={7.5*U} width={2} height={1.5*U} fill={headColor} opacity={0.4} />
      <rect x={6.6*U} y={7.5*U} width={2} height={1.5*U} fill={headColor} opacity={0.4} />
      <rect x={8*U}  y={7.5*U} width={2} height={1.5*U} fill={headColor} opacity={0.4} />
      <rect x={9.4*U} y={7.5*U} width={2} height={1.5*U} fill={headColor} opacity={0.4} />
      {/* chin */}
      <rect x={2*U} y={9*U} width={10*U} height={U} fill={headColor} />

      {/* ── NECK ── */}
      <rect x={5*U} y={10*U} width={4*U} height={U} fill={darkColor} />

      {/* ── SHOULDER PADS ── */}
      <rect x={0} y={10.5*U} width={3*U} height={2*U} fill={bodyColor} />
      <rect x={0} y={10.5*U} width={3*U} height={U} fill="rgba(255,255,255,0.07)" />
      <rect x={11*U} y={10.5*U} width={3*U} height={2*U} fill={bodyColor} />
      <rect x={11*U} y={10.5*U} width={3*U} height={U} fill="rgba(255,255,255,0.07)" />

      {/* ── BODY ── */}
      <rect x={2*U} y={10.5*U} width={10*U} height={5.5*U} fill={bodyColor} />
      {/* chest panel */}
      <rect x={4*U} y={11.5*U} width={6*U} height={4*U} fill={headColor} />
      {/* panel dividers */}
      <rect x={4*U} y={13.2*U} width={6*U} height={1} fill={darkColor} opacity={0.6} />
      <rect x={7*U} y={11.5*U} width={1} height={4*U} fill={darkColor} opacity={0.6} />
      {/* pulsing status light */}
      <rect x={4.5*U} y={12*U} width={U} height={U} fill={eyeColor} filter={sGlow} className="pixel-status-pulse" />
      {/* secondary indicator */}
      <rect x={7.5*U} y={12*U} width={U} height={U} fill={eyeColor} opacity={0.42} />
      {/* bar indicator */}
      <rect x={4.5*U} y={14*U} width={2.5*U} height={U} fill={eyeColor} opacity={0.28} />
      {/* circuit traces */}
      <rect x={2.2*U} y={12*U} width={U} height={1} fill={eyeColor} opacity={0.22} />
      <rect x={2.2*U} y={13.5*U} width={U} height={1} fill={eyeColor} opacity={0.22} />
      <rect x={11*U} y={12*U} width={U} height={1} fill={eyeColor} opacity={0.22} />
      <rect x={11*U} y={13.5*U} width={U} height={1} fill={eyeColor} opacity={0.22} />

      {/* ── LEFT ARM — pivots at shoulder ── */}
      <g className="pixel-char-larm" style={{ transformOrigin: `${2*U}px ${10.5*U}px` }}>
        <rect x={0} y={10.5*U} width={2*U} height={3*U} fill={bodyColor} />
        <rect x={0} y={13.5*U} width={2*U} height={2} fill={eyeColor} opacity={0.45} />
        <rect x={0} y={14*U} width={2*U} height={2*U} fill={bodyColor} />
        <rect x={0} y={15.5*U} width={3*U} height={1.5*U} fill={darkColor} />
        <rect x={U} y={16.5*U} width={U} height={U} fill={darkColor} />
      </g>

      {/* ── RIGHT ARM — pivots at shoulder ── */}
      <g className="pixel-char-rarm" style={{ transformOrigin: `${12*U}px ${10.5*U}px` }}>
        <rect x={12*U} y={10.5*U} width={2*U} height={3*U} fill={bodyColor} />
        <rect x={12*U} y={13.5*U} width={2*U} height={2} fill={eyeColor} opacity={0.45} />
        <rect x={12*U} y={14*U} width={2*U} height={2*U} fill={bodyColor} />
        <rect x={11*U} y={15.5*U} width={3*U} height={1.5*U} fill={darkColor} />
        <rect x={12*U} y={16.5*U} width={U} height={U} fill={darkColor} />
      </g>

      {/* ── HIP CONNECTORS ── */}
      <rect x={3*U} y={16*U} width={3*U} height={U} fill={darkColor} />
      <rect x={8*U} y={16*U} width={3*U} height={U} fill={darkColor} />

      {/* ── LEFT LEG — pivots at hip ── */}
      <g className="pixel-char-lleg" style={{ transformOrigin: `${5*U}px ${17*U}px` }}>
        <rect x={3*U} y={17*U} width={4*U} height={3*U} fill={darkColor} />
        <rect x={3*U} y={19.5*U} width={4*U} height={2} fill="rgba(255,255,255,0.15)" />
        <rect x={3*U} y={20*U} width={4*U} height={2*U} fill={darkColor} />
        <rect x={2*U} y={21.5*U} width={5*U} height={1.5*U} fill={darkColor} />
        <rect x={U} y={22.5*U} width={2*U} height={0.5*U} fill={darkColor} />
      </g>

      {/* ── RIGHT LEG — pivots at hip ── */}
      <g className="pixel-char-rleg" style={{ transformOrigin: `${9*U}px ${17*U}px` }}>
        <rect x={7*U} y={17*U} width={4*U} height={3*U} fill={darkColor} />
        <rect x={7*U} y={19.5*U} width={4*U} height={2} fill="rgba(255,255,255,0.15)" />
        <rect x={7*U} y={20*U} width={4*U} height={2*U} fill={darkColor} />
        <rect x={7*U} y={21.5*U} width={5*U} height={1.5*U} fill={darkColor} />
        <rect x={11*U} y={22.5*U} width={2*U} height={0.5*U} fill={darkColor} />
      </g>

      {/* drop shadow */}
      <ellipse cx={7*U} cy={23*U} rx={4*U} ry={4} fill="rgba(0,0,0,0.22)" />
    </svg>
  );
};

// ── Character wrapper ─────────────────────────────────────────────────────────

type CharacterProps = {
  def: CharDef;
  isMeeting: boolean;
  onRef: (el: HTMLDivElement | null) => void;
};

const Character = ({ def, isMeeting, onRef }: CharacterProps) => {
  const { label, thinking, thinkingDelay, meetText, eyeColor, scale, topPos, opacity, speed } = def;

  // Negative delay = robot starts mid-animation at a unique random position.
  // deterministicRandom ensures server and client render identically.
  const startDelay = `${-(deterministicRandom(def.id) * speed).toFixed(2)}s`;

  const outerStyle: CSSProperties = {
    position: "absolute",
    top: topPos,
    left: 0,
    animation: `pw-path-${def.id} ${speed}s linear ${startDelay} infinite`,
    pointerEvents: "none",
    willChange: "transform",
    zIndex: 1,
  };

  const innerStyle: CSSProperties = {
    transform: `scale(${scale})`,
    transformOrigin: "top left",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    opacity,
  };

  const labelStyle: CSSProperties = {
    fontSize: 8,
    fontFamily: "var(--font-mono)",
    color: eyeColor,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    opacity: 0.7,
    textShadow: `0 0 8px ${eyeColor}80`,
  };

  return (
    <div ref={onRef} style={outerStyle}>
      <div style={innerStyle}>
        {isMeeting ? (
          <MeetingBubble text={meetText} color={eyeColor} />
        ) : (
          thinking && <ThinkingBubble text={thinking} delay={thinkingDelay} color={eyeColor} />
        )}
        <div className="pixel-char-bob">
          <RobotSVG
            id={def.id}
            eyeColor={def.eyeColor}
            headColor={def.headColor}
            bodyColor={def.bodyColor}
            darkColor={def.darkColor}
            dir={def.dir}
          />
        </div>
        <div style={labelStyle}>{label}</div>
      </div>
    </div>
  );
};

// ── Root component — manages paths, proximity detection, and meeting state ────

export const PixelWorkers = () => {
  const [meetingRobots, setMeetingRobots] = useState<ReadonlySet<string>>(new Set());
  const robotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastMeetRef = useRef<Map<string, number>>(new Map());

  // Stable ref callbacks — created once, never change
  const refCallbacks = useMemo(
    () =>
      new Map(
        CHARS.map(({ id }) => [
          id,
          (el: HTMLDivElement | null) => {
            if (el) robotRefs.current.set(id, el);
            else robotRefs.current.delete(id);
          },
        ])
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Wavy-path keyframes generated once (uses calc(vw), so SSR-safe + responsive)
  const pathCSS = useMemo(() => buildPathKeyframes(CHARS), []);

  // Poll for robot proximity every 200 ms
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const pos = new Map<string, { x: number; y: number }>();
      robotRefs.current.forEach((el, rid) => {
        const r = el.getBoundingClientRect();
        pos.set(rid, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      });

      const ids = [...pos.keys()];
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = pos.get(ids[i])!;
          const b = pos.get(ids[j])!;
          if (Math.hypot(a.x - b.x, a.y - b.y) < PROXIMITY_PX) {
            lastMeetRef.current.set(ids[i], now);
            lastMeetRef.current.set(ids[j], now);
          }
        }
      }

      // Include robots whose meeting linger hasn't expired yet
      const next = new Set<string>();
      CHARS.forEach(({ id }) => {
        const last = lastMeetRef.current.get(id) ?? 0;
        if (now - last < MEETING_LINGER_MS) next.add(id);
      });

      setMeetingRobots(next);
    }, 200);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {/* Inject wavy-path keyframes into <head> */}
      <style dangerouslySetInnerHTML={{ __html: pathCSS }} />
      {CHARS.map((def) => (
        <Character
          key={def.id}
          def={def}
          isMeeting={meetingRobots.has(def.id)}
          onRef={refCallbacks.get(def.id)!}
        />
      ))}
    </>
  );
};
