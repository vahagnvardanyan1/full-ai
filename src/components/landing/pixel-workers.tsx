"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import type { CSSProperties } from "react";

// Grid unit: 4 px
const U = 4;

const MEETING_LINGER_MS = 1600;
const PROXIMITY_PX = 160;

const deterministicRandom = (seed: string): number => {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) & 0xffffffff;
  }
  return (h >>> 0) / 4294967295;
};

type Skin = "blob" | "boxy" | "rover" | "drone" | "spider";

type CharDef = {
  id: string;
  skin: Skin;
  label: string;
  thinking: string | null;
  meetText: string;
  thinkingDelay: string;
  eyeColor: string;
  bodyColor: string;
  darkColor: string;
  speed: number;
  topPos: string;
  scale: number;
  opacity: number;
  dir: "ltr" | "rtl";
  waviness: number;
  waveFreq: number;
  wavePhase: number;
};

const CHARS: CharDef[] = [
  {
    id: "core",
    skin: "blob",
    label: "Core",
    thinking: "THINKING...",
    meetText: "OH HI!",
    thinkingDelay: "0s",
    eyeColor: "#60a5fa",
    bodyColor: "#1e3a5f",
    darkColor: "#0c1f35",
    speed: 20,
    topPos: "14%",
    scale: 0.62,
    opacity: 0.88,
    dir: "ltr",
    waviness: 30,
    waveFreq: 0.9,
    wavePhase: 0,
  },
  {
    id: "boxy",
    skin: "boxy",
    label: "Boxy",
    thinking: "WORKING...",
    meetText: "HELLO!",
    thinkingDelay: "1.8s",
    eyeColor: "#fde047",
    bodyColor: "#78350f",
    darkColor: "#3d1900",
    speed: 16,
    topPos: "52%",
    scale: 0.76,
    opacity: 0.92,
    dir: "rtl",
    waviness: 22,
    waveFreq: 2.0,
    wavePhase: 2.1,
  },
  {
    id: "slick",
    skin: "rover",
    label: "Rover",
    thinking: "SCANNING...",
    meetText: "FOUND YOU",
    thinkingDelay: "3s",
    eyeColor: "#e879f9",
    bodyColor: "#581c87",
    darkColor: "#3b0764",
    speed: 13,
    topPos: "72%",
    scale: 0.72,
    opacity: 0.94,
    dir: "ltr",
    waviness: 18,
    waveFreq: 1.1,
    wavePhase: 4.0,
  },
  {
    id: "ping",
    skin: "drone",
    label: "Ping",
    thinking: "LOADING...",
    meetText: "WAZZUP!",
    thinkingDelay: "2.4s",
    eyeColor: "#4ade80",
    bodyColor: "#14532d",
    darkColor: "#052e16",
    speed: 18,
    topPos: "34%",
    scale: 0.55,
    opacity: 0.80,
    dir: "rtl",
    waviness: 36,
    waveFreq: 1.4,
    wavePhase: 1.8,
  },
  {
    id: "zap",
    skin: "spider",
    label: "Zap",
    thinking: "RUNNING...",
    meetText: "HEY YOU!",
    thinkingDelay: "0.6s",
    eyeColor: "#fb923c",
    bodyColor: "#7c2d12",
    darkColor: "#431407",
    speed: 15,
    topPos: "62%",
    scale: 0.68,
    opacity: 0.86,
    dir: "rtl",
    waviness: 24,
    waveFreq: 1.7,
    wavePhase: 3.2,
  },
];

const buildPathKeyframes = ({ chars }: { chars: CharDef[] }): string => {
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
        const y = (
          waviness * Math.sin(waveFreq * t * Math.PI * 2 + wavePhase)
        ).toFixed(1);
        frames += `${pct}%{transform:translateX(${xExpr}) translateY(${y}px);}`;
      }
      return `@keyframes pw-path-${id}{${frames}}`;
    })
    .join("\n");
};

// ── Thinking bubble ───────────────────────────────────────────────────────────

type ThinkingBubbleProps = {
  text: string;
  delay: string;
  color: string;
};

const ThinkingBubble = ({ text, delay, color }: ThinkingBubbleProps) => (
  <div
    className="pixel-thinking"
    style={{
      background: "rgba(4,8,18,0.96)",
      border: `1.5px solid ${color}`,
      borderRadius: 8,
      padding: "3px 9px",
      fontSize: 8,
      fontFamily: "var(--font-mono, monospace)",
      fontWeight: 700,
      color,
      whiteSpace: "nowrap",
      letterSpacing: "0.1em",
      position: "relative",
      boxShadow: `0 0 14px ${color}77`,
      animationDelay: delay,
    }}
  >
    {text}
    <div
      style={{
        position: "absolute",
        bottom: -6,
        left: "50%",
        transform: "translateX(-50%)",
        width: 0,
        height: 0,
        borderLeft: "4px solid transparent",
        borderRight: "4px solid transparent",
        borderTop: `6px solid ${color}`,
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: -4,
        left: "50%",
        transform: "translateX(-50%)",
        width: 0,
        height: 0,
        borderLeft: "3px solid transparent",
        borderRight: "3px solid transparent",
        borderTop: "5px solid rgba(4,8,18,0.96)",
      }}
    />
  </div>
);

// ── Meeting bubble ────────────────────────────────────────────────────────────

type MeetingBubbleProps = {
  text: string;
  color: string;
};

const MeetingBubble = ({ text, color }: MeetingBubbleProps) => (
  <div
    className="pixel-meeting-pop"
    style={{
      background: "rgba(4,8,18,0.99)",
      border: `2px solid ${color}`,
      borderRadius: 8,
      padding: "3px 10px",
      fontSize: 9,
      fontFamily: "var(--font-mono, monospace)",
      fontWeight: 700,
      color,
      whiteSpace: "nowrap",
      letterSpacing: "0.08em",
      position: "relative",
      boxShadow: `0 0 24px ${color}bb, inset 0 0 8px ${color}22`,
    }}
  >
    {text}
    <div
      style={{
        position: "absolute",
        bottom: -7,
        left: "50%",
        transform: "translateX(-50%)",
        width: 0,
        height: 0,
        borderLeft: "5px solid transparent",
        borderRight: "5px solid transparent",
        borderTop: `7px solid ${color}`,
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: -5,
        left: "50%",
        transform: "translateX(-50%)",
        width: 0,
        height: 0,
        borderLeft: "4px solid transparent",
        borderRight: "4px solid transparent",
        borderTop: "6px solid rgba(4,8,18,0.99)",
      }}
    />
  </div>
);

// ── SVG helpers ───────────────────────────────────────────────────────────────

type BotProps = {
  id: string;
  eyeColor: string;
  bodyColor: string;
  darkColor: string;
  dir: "ltr" | "rtl";
};

const makeGlowFilter = (id: string, std = 2.5) => (
  <filter id={`pw-glow-${id}`} x="-80%" y="-80%" width="260%" height="260%">
    <feGaussianBlur in="SourceGraphic" stdDeviation={std} result="blur" />
    <feMerge>
      <feMergeNode in="blur" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);
const makeSoftGlow = (id: string) => (
  <filter id={`pw-sglow-${id}`} x="-120%" y="-120%" width="340%" height="340%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
    <feMerge>
      <feMergeNode in="blur" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);
const makeTopGrad = (id: string, suffix: string) => (
  <linearGradient id={`pw-grad-${suffix}-${id}`} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
    <stop offset="100%" stopColor="rgba(0,0,0,0.20)" />
  </linearGradient>
);
const makeRadarRing = ({ id, eyeColor }: Pick<BotProps, "id" | "eyeColor">) => (
  <>
    <g
      className="pixel-radar-ring"
      style={{ transformOrigin: `${7 * U}px ${U}px` }}
    >
      <circle
        cx={7 * U}
        cy={U}
        r={5}
        fill="none"
        stroke={eyeColor}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        opacity={0.75}
      />
    </g>
    <g
      className="pixel-radar-ring-2"
      style={{ transformOrigin: `${7 * U}px ${U}px` }}
    >
      <circle
        cx={7 * U}
        cy={U}
        r={5}
        fill="none"
        stroke={eyeColor}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        opacity={0.38}
      />
    </g>
  </>
);

// ── Bot 1: BLOB — a big friendly floating orb ─────────────────────────────────
//
//  No legs — the entire bot is a glowing sphere with one large expressive eye.
//  It floats and bobs gently. Perfect for the "Core" persona.

const BlobBot = ({ id, eyeColor, bodyColor, darkColor }: BotProps) => {
  const W = 14 * U; // 56
  const H = 22 * U; // 88
  const CX = 7 * U;
  const CY = 9 * U;
  const glow = `url(#pw-glow-${id})`;
  const sGlow = `url(#pw-sglow-${id})`;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        {makeGlowFilter(id)}
        {makeSoftGlow(id)}
        <radialGradient id={`pw-blob-body-${id}`} cx="35%" cy="28%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.12)" />
        </radialGradient>
        <radialGradient id={`pw-blob-glow-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={eyeColor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={eyeColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      {makeRadarRing({ id, eyeColor })}

      {/* Antenna */}
      <rect
        x={CX - 1}
        y={U * 0.5}
        width={2}
        height={U * 2}
        fill={eyeColor}
        opacity={0.55}
      />
      <circle
        cx={CX}
        cy={U * 0.5}
        r={U * 0.75}
        fill={eyeColor}
        filter={glow}
        className="pixel-antenna-pulse"
      />

      {/* Outer ambient glow */}
      <circle cx={CX} cy={CY} r={7 * U} fill={`url(#pw-blob-glow-${id})`} />

      {/* Body sphere */}
      <circle cx={CX} cy={CY} r={6 * U} fill={bodyColor} />
      <circle cx={CX} cy={CY} r={6 * U} fill={`url(#pw-blob-body-${id})`} />

      {/* Face lens (darker dome) */}
      <circle
        cx={CX}
        cy={CY + U * 0.4}
        r={4.5 * U}
        fill={darkColor}
        opacity={0.82}
      />

      {/* Eye glow halo */}
      <circle cx={CX} cy={CY} r={3.5 * U} fill={eyeColor} opacity={0.14} />

      {/* Main eye */}
      <circle
        cx={CX}
        cy={CY}
        r={2.8 * U}
        fill={eyeColor}
        filter={glow}
        className="pixel-eye-glow"
      />

      {/* Pupil */}
      <circle
        cx={CX + U * 0.55}
        cy={CY - U * 0.35}
        r={U * 1.05}
        fill={darkColor}
      />

      {/* Eye speculars */}
      <circle
        cx={CX - U * 0.9}
        cy={CY - U * 1.1}
        r={U * 0.42}
        fill="white"
        opacity={0.95}
      />
      <circle
        cx={CX - U * 0.3}
        cy={CY - U * 0.65}
        r={U * 0.22}
        fill="white"
        opacity={0.7}
      />

      {/* Left fin */}
      <ellipse
        cx={U * 0.7}
        cy={CY + U * 0.5}
        rx={U * 1.6}
        ry={U * 0.9}
        fill={bodyColor}
      />
      <circle
        cx={U * 0.5}
        cy={CY + U * 0.3}
        r={U * 0.35}
        fill={eyeColor}
        opacity={0.55}
      />

      {/* Right fin */}
      <ellipse
        cx={W - U * 0.7}
        cy={CY + U * 0.5}
        rx={U * 1.6}
        ry={U * 0.9}
        fill={bodyColor}
      />
      <circle
        cx={W - U * 0.5}
        cy={CY + U * 0.3}
        r={U * 0.35}
        fill={eyeColor}
        opacity={0.55}
      />

      {/* Thruster glow (bottom) */}
      <ellipse
        cx={CX}
        cy={CY + U * 6.6}
        rx={3 * U}
        ry={U * 0.75}
        fill={eyeColor}
        opacity={0.18}
      />
      <ellipse
        cx={CX}
        cy={CY + U * 6.6}
        rx={U * 1.5}
        ry={U * 0.38}
        fill={eyeColor}
        opacity={0.15}
        className="pixel-status-pulse"
      />

      {/* Ground shadow */}
      <ellipse
        cx={CX}
        cy={H - U * 0.4}
        rx={U * 3.5}
        ry={U * 0.55}
        fill="rgba(0,0,0,0.20)"
      />
    </svg>
  );
};

// ── Bot 2: BOXY — a round-cornered cheerful walking square ───────────────────
//
//  Big rounded rectangle head with two large circular eyes, smile, and short legs.
//  Walks with the standard leg swing animation. Fun and friendly look.

const BoxyBot = ({ id, eyeColor, bodyColor, darkColor, dir }: BotProps) => {
  const W = 14 * U;
  const H = 22 * U;
  const CX = 7 * U;
  const glow = `url(#pw-glow-${id})`;
  const sGlow = `url(#pw-sglow-${id})`;
  const grad = `url(#pw-grad-body-${id})`;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{
        overflow: "visible",
        ...(dir === "rtl" ? { transform: "scaleX(-1)" } : {}),
      }}
    >
      <defs>
        {makeGlowFilter(id)}
        {makeSoftGlow(id)}
        {makeTopGrad(id, "body")}
      </defs>

      {makeRadarRing({ id, eyeColor })}

      {/* Antenna */}
      <rect
        x={CX - 1}
        y={0}
        width={2}
        height={U * 2.2}
        fill={eyeColor}
        opacity={0.6}
      />
      <circle
        cx={CX}
        cy={0}
        r={U * 0.85}
        fill={eyeColor}
        filter={glow}
        className="pixel-antenna-pulse"
      />

      {/* HEAD — big rounded rect */}
      <rect
        x={U}
        y={U * 2}
        width={U * 12}
        height={U * 8}
        rx={U * 2.5}
        fill={bodyColor}
      />
      <rect
        x={U}
        y={U * 2}
        width={U * 12}
        height={U * 8}
        rx={U * 2.5}
        fill={grad}
      />
      {/* head top shine */}
      <rect
        x={U * 2.5}
        y={U * 2.4}
        width={U * 9}
        height={U * 1.2}
        rx={U * 2}
        fill="rgba(255,255,255,0.10)"
      />

      {/* Left eye housing */}
      <circle
        cx={U * 4.5}
        cy={U * 5.5}
        r={U * 2.2}
        fill={darkColor}
        opacity={0.9}
      />
      {/* Right eye housing */}
      <circle
        cx={U * 9.5}
        cy={U * 5.5}
        r={U * 2.2}
        fill={darkColor}
        opacity={0.9}
      />

      {/* Left eye */}
      <circle
        cx={U * 4.5}
        cy={U * 5.5}
        r={U * 1.6}
        fill={eyeColor}
        filter={glow}
        className="pixel-eye-glow"
      />
      {/* Right eye */}
      <circle
        cx={U * 9.5}
        cy={U * 5.5}
        r={U * 1.6}
        fill={eyeColor}
        filter={glow}
        className="pixel-eye-glow"
      />

      {/* Left pupil */}
      <circle cx={U * 4.8} cy={U * 5.2} r={U * 0.75} fill={darkColor} />
      {/* Right pupil */}
      <circle cx={U * 9.8} cy={U * 5.2} r={U * 0.75} fill={darkColor} />

      {/* Eye speculars */}
      <circle
        cx={U * 4.0}
        cy={U * 4.8}
        r={U * 0.35}
        fill="white"
        opacity={0.95}
      />
      <circle
        cx={U * 9.0}
        cy={U * 4.8}
        r={U * 0.35}
        fill="white"
        opacity={0.95}
      />

      {/* Smile */}
      <path
        d={`M ${U * 4.2} ${U * 8.2} Q ${CX} ${U * 9.8} ${U * 9.8} ${U * 8.2}`}
        stroke={eyeColor}
        strokeWidth={1.5}
        fill="none"
        opacity={0.75}
        strokeLinecap="round"
      />

      {/* Blush */}
      <circle
        cx={U * 2.8}
        cy={U * 7.2}
        r={U * 1.1}
        fill={eyeColor}
        opacity={0.1}
      />
      <circle
        cx={U * 11.2}
        cy={U * 7.2}
        r={U * 1.1}
        fill={eyeColor}
        opacity={0.1}
      />

      {/* BODY */}
      <rect
        x={U * 3}
        y={U * 10.5}
        width={U * 8}
        height={U * 5}
        rx={U * 1.8}
        fill={bodyColor}
      />
      <rect
        x={U * 3}
        y={U * 10.5}
        width={U * 8}
        height={U * 5}
        rx={U * 1.8}
        fill={grad}
      />

      {/* Chest gem */}
      <circle cx={CX} cy={U * 13} r={U * 1.2} fill={darkColor} opacity={0.9} />
      <circle
        cx={CX}
        cy={U * 13}
        r={U * 0.8}
        fill={eyeColor}
        filter={sGlow}
        className="pixel-status-pulse"
      />

      {/* LEFT ARM */}
      <g
        className="pixel-char-larm"
        style={{ transformOrigin: `${U * 3}px ${U * 11}px` }}
      >
        <rect
          x={U * 0.5}
          y={U * 11}
          width={U * 2.5}
          height={U * 4}
          rx={U * 1.2}
          fill={bodyColor}
        />
        <rect
          x={U * 0.2}
          y={U * 14.6}
          width={U * 3}
          height={U * 1.4}
          rx={U * 0.9}
          fill={bodyColor}
        />
      </g>

      {/* RIGHT ARM */}
      <g
        className="pixel-char-rarm"
        style={{ transformOrigin: `${U * 11}px ${U * 11}px` }}
      >
        <rect
          x={U * 11}
          y={U * 11}
          width={U * 2.5}
          height={U * 4}
          rx={U * 1.2}
          fill={bodyColor}
        />
        <rect
          x={U * 10.8}
          y={U * 14.6}
          width={U * 3}
          height={U * 1.4}
          rx={U * 0.9}
          fill={bodyColor}
        />
      </g>

      {/* LEFT LEG */}
      <g
        className="pixel-char-lleg"
        style={{ transformOrigin: `${U * 5.5}px ${U * 15.5}px` }}
      >
        <rect
          x={U * 3.5}
          y={U * 15.5}
          width={U * 4}
          height={U * 3.5}
          rx={U * 1.5}
          fill={bodyColor}
        />
        <rect
          x={U * 3}
          y={U * 18.5}
          width={U * 5}
          height={U * 2}
          rx={U * 1}
          fill={darkColor}
        />
      </g>

      {/* RIGHT LEG */}
      <g
        className="pixel-char-rleg"
        style={{ transformOrigin: `${U * 8.5}px ${U * 15.5}px` }}
      >
        <rect
          x={U * 6.5}
          y={U * 15.5}
          width={U * 4}
          height={U * 3.5}
          rx={U * 1.5}
          fill={bodyColor}
        />
        <rect
          x={U * 6}
          y={U * 18.5}
          width={U * 5}
          height={U * 2}
          rx={U * 1}
          fill={darkColor}
        />
      </g>

      <ellipse cx={CX} cy={H - 2} rx={U * 4} ry={4} fill="rgba(0,0,0,0.20)" />
    </svg>
  );
};

// ── Bot 3: SLICK — sleek oval head with wide panoramic visor ─────────────────
//
//  Tall oval head, a single glowing visor strip (no separate eyes), slim cyber body.
//  Walks with the same leg animation. Gives a "cool AI agent" vibe.

// ── Bot 3: ROVER — wheeled tank/rover with spinning wheels ───────────────────
//
//  Compact body with two large spoked wheels, a turret dome on top, and
//  headlight eyes. Wheels spin (CW for ltr, CCW for rtl) and the whole
//  rover jiggles slightly as if rolling over terrain.

const RoverBot = ({ id, eyeColor, bodyColor, darkColor, dir }: BotProps) => {
  const W  = 14 * U;
  const H  = 22 * U;
  const CX = 7 * U;
  // Wheel geometry
  const LWX = 3 * U;     // left wheel center X
  const RWX = 11 * U;    // right wheel center X
  const WY  = 15.5 * U;  // wheel axle Y
  const WR  = 3.5 * U;   // wheel radius
  const spinClass = dir === "ltr" ? "cartoon-wheel-cw" : "cartoon-wheel-ccw";

  const glow  = `url(#pw-glow-${id})`;
  const sGlow = `url(#pw-sglow-${id})`;
  const grad  = `url(#pw-grad-body-${id})`;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        {makeGlowFilter(id)}
        {makeSoftGlow(id)}
        {makeTopGrad(id, "body")}
        <radialGradient id={`pw-wheel-${id}`} cx="38%" cy="32%" r="62%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
        </radialGradient>
      </defs>

      {makeRadarRing({ id, eyeColor })}

      {/* ── ANTENNA ── */}
      <rect x={CX - 1} y={0} width={2} height={U * 2.2} fill={eyeColor} opacity={0.55} />
      <circle cx={CX} cy={0} r={U * 0.8} fill={eyeColor} filter={glow} className="pixel-antenna-pulse" />

      {/* ── TURRET DOME ── */}
      <ellipse cx={CX} cy={U * 7.8} rx={U * 3.8} ry={U * 2.4} fill={bodyColor} />
      <ellipse cx={CX} cy={U * 7.8} rx={U * 3.8} ry={U * 2.4} fill={grad} />
      {/* dome window */}
      <ellipse cx={CX} cy={U * 7.6} rx={U * 2.6} ry={U * 1.5} fill={darkColor} opacity={0.92} />
      <ellipse cx={CX} cy={U * 7.5} rx={U * 2.0} ry={U * 1.1} fill={eyeColor} filter={glow} className="pixel-eye-glow" opacity={0.82} />
      {/* dome specular */}
      <ellipse cx={CX - U} cy={U * 7.0} rx={U * 0.9} ry={U * 0.45} fill="rgba(255,255,255,0.52)" />

      {/* ── BODY ── */}
      <rect x={U * 1.2} y={U * 9.5} width={U * 11.6} height={U * 7} rx={U * 2} fill={bodyColor} />
      <rect x={U * 1.2} y={U * 9.5} width={U * 11.6} height={U * 7} rx={U * 2} fill={grad} />
      {/* top edge shine */}
      <rect x={U * 1.2} y={U * 9.5} width={U * 11.6} height={U * 1.2} rx={U * 2} fill="rgba(255,255,255,0.10)" />

      {/* ── HEADLIGHTS (eyes) ── */}
      <circle cx={U * 4.4} cy={U * 12} r={U * 1.1} fill={darkColor} opacity={0.9} />
      <circle cx={U * 4.4} cy={U * 12} r={U * 0.72} fill={eyeColor} filter={glow} className="pixel-eye-glow" />
      <circle cx={U * 4.4 - 3} cy={U * 12 - 3} r={3} fill="white" opacity={0.75} />

      <circle cx={U * 9.6} cy={U * 12} r={U * 1.1} fill={darkColor} opacity={0.9} />
      <circle cx={U * 9.6} cy={U * 12} r={U * 0.72} fill={eyeColor} filter={glow} className="pixel-eye-glow" />
      <circle cx={U * 9.6 - 3} cy={U * 12 - 3} r={3} fill="white" opacity={0.75} />

      {/* ── FRONT GRILLE ── */}
      <rect x={U * 4.8} y={U * 13.8} width={U * 4.4} height={U * 1.4} rx={U * 0.7} fill={darkColor} opacity={0.8} />
      <rect x={U * 5.4} y={U * 13.9} width={U * 0.9} height={U * 1.2} fill={eyeColor} opacity={0.28} />
      <rect x={U * 6.6} y={U * 13.9} width={U * 0.9} height={U * 1.2} fill={eyeColor} opacity={0.28} />
      <rect x={U * 7.8} y={U * 13.9} width={U * 0.9} height={U * 1.2} fill={eyeColor} opacity={0.28} />

      {/* ── BELLY STATUS LIGHT ── */}
      <circle cx={CX} cy={U * 15.4} r={U * 0.85} fill={darkColor} />
      <circle cx={CX} cy={U * 15.4} r={U * 0.5} fill={eyeColor} filter={sGlow} className="pixel-status-pulse" />

      {/* ── SIDE PANEL VENTS ── */}
      <rect x={U * 1.2} y={U * 11.5} width={U * 1.8} height={U * 3.5} rx={U * 0.5} fill={darkColor} opacity={0.38} />
      <rect x={U * 11} y={U * 11.5} width={U * 1.8} height={U * 3.5} rx={U * 0.5} fill={darkColor} opacity={0.38} />

      {/* ── LEFT WHEEL ── */}
      {/* wheel well shadow */}
      <circle cx={LWX} cy={WY} r={WR + U * 0.6} fill={darkColor} opacity={0.45} />
      {/* tire */}
      <circle cx={LWX} cy={WY} r={WR} fill={bodyColor} />
      <circle cx={LWX} cy={WY} r={WR} fill={`url(#pw-wheel-${id})`} />
      <circle cx={LWX} cy={WY} r={WR} fill="none" stroke={eyeColor} strokeWidth={2.5} opacity={0.45} />
      {/* spinning spokes */}
      <g className={spinClass} style={{ transformOrigin: `${LWX}px ${WY}px` }}>
        <line x1={LWX} y1={WY - WR + 3} x2={LWX} y2={WY + WR - 3} stroke={eyeColor} strokeWidth={1.8} opacity={0.55} strokeLinecap="round" />
        <line x1={LWX - WR + 3} y1={WY} x2={LWX + WR - 3} y2={WY} stroke={eyeColor} strokeWidth={1.8} opacity={0.55} strokeLinecap="round" />
        <line x1={LWX - (WR - 3) * 0.71} y1={WY - (WR - 3) * 0.71} x2={LWX + (WR - 3) * 0.71} y2={WY + (WR - 3) * 0.71} stroke={eyeColor} strokeWidth={1.2} opacity={0.32} strokeLinecap="round" />
        <line x1={LWX + (WR - 3) * 0.71} y1={WY - (WR - 3) * 0.71} x2={LWX - (WR - 3) * 0.71} y2={WY + (WR - 3) * 0.71} stroke={eyeColor} strokeWidth={1.2} opacity={0.32} strokeLinecap="round" />
      </g>
      {/* hub */}
      <circle cx={LWX} cy={WY} r={U * 0.9} fill={darkColor} />
      <circle cx={LWX} cy={WY} r={U * 0.45} fill={eyeColor} opacity={0.85} />

      {/* ── RIGHT WHEEL ── */}
      <circle cx={RWX} cy={WY} r={WR + U * 0.6} fill={darkColor} opacity={0.45} />
      <circle cx={RWX} cy={WY} r={WR} fill={bodyColor} />
      <circle cx={RWX} cy={WY} r={WR} fill={`url(#pw-wheel-${id})`} />
      <circle cx={RWX} cy={WY} r={WR} fill="none" stroke={eyeColor} strokeWidth={2.5} opacity={0.45} />
      <g className={spinClass} style={{ transformOrigin: `${RWX}px ${WY}px` }}>
        <line x1={RWX} y1={WY - WR + 3} x2={RWX} y2={WY + WR - 3} stroke={eyeColor} strokeWidth={1.8} opacity={0.55} strokeLinecap="round" />
        <line x1={RWX - WR + 3} y1={WY} x2={RWX + WR - 3} y2={WY} stroke={eyeColor} strokeWidth={1.8} opacity={0.55} strokeLinecap="round" />
        <line x1={RWX - (WR - 3) * 0.71} y1={WY - (WR - 3) * 0.71} x2={RWX + (WR - 3) * 0.71} y2={WY + (WR - 3) * 0.71} stroke={eyeColor} strokeWidth={1.2} opacity={0.32} strokeLinecap="round" />
        <line x1={RWX + (WR - 3) * 0.71} y1={WY - (WR - 3) * 0.71} x2={RWX - (WR - 3) * 0.71} y2={WY + (WR - 3) * 0.71} stroke={eyeColor} strokeWidth={1.2} opacity={0.32} strokeLinecap="round" />
      </g>
      <circle cx={RWX} cy={WY} r={U * 0.9} fill={darkColor} />
      <circle cx={RWX} cy={WY} r={U * 0.45} fill={eyeColor} opacity={0.85} />

      {/* ── UNDER-WHEEL GLOW ── */}
      <ellipse cx={LWX} cy={WY + WR + 2} rx={WR * 0.75} ry={3} fill={eyeColor} opacity={0.12} />
      <ellipse cx={RWX} cy={WY + WR + 2} rx={WR * 0.75} ry={3} fill={eyeColor} opacity={0.12} />

      {/* ground shadow */}
      <ellipse cx={CX} cy={H - 2} rx={U * 5.5} ry={U * 0.65} fill="rgba(0,0,0,0.22)" />
    </svg>
  );
};

// ── Bot 4: DRONE — quad-rotor with spinning propellers ───────────────────────
//
//  Compact pill body, two arm struts extending left/right, a rotor disc at
//  each tip (blades spin via cartoon-rotor-spin), a big camera eye, a signal
//  dish arc above the antenna, and landing skids below.  Symmetric so no
//  dir-flip is applied.

const DroneBot = ({ id, eyeColor, bodyColor, darkColor }: BotProps) => {
  const W   = 14 * U;
  const H   = 22 * U;
  const CX  = 7 * U;
  const LRX = 1.5 * U;   // left  rotor centre X
  const RRX = 12.5 * U;  // right rotor centre X
  const RY  = 10 * U;    // rotor axle Y
  const RR  = 2.2 * U;   // rotor disc radius

  const glow  = `url(#pw-glow-${id})`;
  const sGlow = `url(#pw-sglow-${id})`;
  const grad  = `url(#pw-grad-body-${id})`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <defs>
        {makeGlowFilter(id)}
        {makeSoftGlow(id)}
        {makeTopGrad(id, "body")}
        <radialGradient id={`pw-rotor-disc-${id}`} cx="38%" cy="32%" r="65%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
        </radialGradient>
      </defs>

      {makeRadarRing({ id, eyeColor })}

      {/* ── ANTENNA / SIGNAL MAST ── */}
      <rect x={CX - 1} y={0} width={2} height={U * 2} fill={eyeColor} opacity={0.55} />
      <circle cx={CX} cy={0} r={U * 0.8} fill={eyeColor} filter={glow} className="pixel-antenna-pulse" />
      <path
        d={`M ${CX - U * 1.6},${U * 3.6} Q ${CX},${U * 2.4} ${CX + U * 1.6},${U * 3.6}`}
        stroke={eyeColor}
        strokeWidth={2}
        fill="none"
        opacity={0.6}
        strokeLinecap="round"
      />
      <rect x={CX - 1} y={U * 2} width={2} height={U * 2} fill={eyeColor} opacity={0.5} />

      {/* ── ARM STRUTS ── */}
      <rect x={0} y={RY - U * 0.55} width={U * 3.8} height={U * 1.1} rx={U * 0.45} fill={bodyColor} />
      <rect x={U * 10.2} y={RY - U * 0.55} width={U * 3.8} height={U * 1.1} rx={U * 0.45} fill={bodyColor} />

      {/* ── MAIN BODY ── */}
      <rect x={U * 2.8} y={U * 8} width={U * 8.4} height={U * 6} rx={U * 2.8} fill={bodyColor} />
      <rect x={U * 2.8} y={U * 8} width={U * 8.4} height={U * 6} rx={U * 2.8} fill={grad} />
      <rect x={U * 3.4} y={U * 8.4} width={U * 7.2} height={U * 1.1} rx={U * 2} fill="rgba(255,255,255,0.10)" />

      {/* ── BIG CAMERA EYE ── */}
      <circle cx={CX} cy={U * 11.2} r={U * 2.0} fill={darkColor} opacity={0.92} />
      <circle cx={CX} cy={U * 11.2} r={U * 1.42} fill={eyeColor} filter={glow} className="pixel-eye-glow" />
      <circle cx={CX - U * 0.55} cy={U * 11.2 - U * 0.55} r={U * 0.55} fill="white" opacity={0.72} />

      {/* ── STATUS LED ── */}
      <circle cx={U * 4.5} cy={U * 9.2} r={U * 0.42} fill={darkColor} />
      <circle cx={U * 4.5} cy={U * 9.2} r={U * 0.24} fill={eyeColor} filter={sGlow} className="pixel-status-pulse" />

      {/* ── LEFT ROTOR DISC ── */}
      <circle cx={LRX} cy={RY} r={RR + U * 0.45} fill={darkColor} opacity={0.45} />
      <circle cx={LRX} cy={RY} r={RR} fill={bodyColor} />
      <circle cx={LRX} cy={RY} r={RR} fill={`url(#pw-rotor-disc-${id})`} />
      <g className="cartoon-rotor-spin" style={{ transformOrigin: `${LRX}px ${RY}px` }}>
        <ellipse cx={LRX} cy={RY} rx={RR - 2} ry={U * 0.32} fill={eyeColor} opacity={0.72} />
        <ellipse cx={LRX} cy={RY} rx={U * 0.32} ry={RR - 2} fill={eyeColor} opacity={0.72} />
      </g>
      <circle cx={LRX} cy={RY} r={U * 0.58} fill={darkColor} />
      <circle cx={LRX} cy={RY} r={U * 0.28} fill={eyeColor} opacity={0.9} />
      <circle cx={LRX} cy={RY} r={RR} fill="none" stroke={eyeColor} strokeWidth={1.5} opacity={0.32} />

      {/* ── RIGHT ROTOR DISC ── */}
      <circle cx={RRX} cy={RY} r={RR + U * 0.45} fill={darkColor} opacity={0.45} />
      <circle cx={RRX} cy={RY} r={RR} fill={bodyColor} />
      <circle cx={RRX} cy={RY} r={RR} fill={`url(#pw-rotor-disc-${id})`} />
      <g className="cartoon-rotor-spin" style={{ transformOrigin: `${RRX}px ${RY}px` }}>
        <ellipse cx={RRX} cy={RY} rx={RR - 2} ry={U * 0.32} fill={eyeColor} opacity={0.72} />
        <ellipse cx={RRX} cy={RY} rx={U * 0.32} ry={RR - 2} fill={eyeColor} opacity={0.72} />
      </g>
      <circle cx={RRX} cy={RY} r={U * 0.58} fill={darkColor} />
      <circle cx={RRX} cy={RY} r={U * 0.28} fill={eyeColor} opacity={0.9} />
      <circle cx={RRX} cy={RY} r={RR} fill="none" stroke={eyeColor} strokeWidth={1.5} opacity={0.32} />

      {/* ── LANDING SKIDS ── */}
      <line x1={U * 4.5} y1={U * 14} x2={U * 3.2} y2={U * 17} stroke={bodyColor} strokeWidth={2.2} strokeLinecap="round" />
      <line x1={U * 9.5} y1={U * 14} x2={U * 10.8} y2={U * 17} stroke={bodyColor} strokeWidth={2.2} strokeLinecap="round" />
      <rect x={U * 1.5} y={U * 16.7} width={U * 4.2} height={U * 0.85} rx={U * 0.4} fill={bodyColor} opacity={0.82} />
      <rect x={U * 8.3} y={U * 16.7} width={U * 4.2} height={U * 0.85} rx={U * 0.4} fill={bodyColor} opacity={0.82} />

      <ellipse cx={CX} cy={H - 2} rx={U * 4.2} ry={U * 0.6} fill="rgba(0,0,0,0.2)" />
    </svg>
  );
};

// ── Bot 5: SPIDER — hexapod crawler with stalked eyes ────────────────────────
//
//  Wide oval carapace, two eye stalks with glowing eyes, twin antennae,
//  3 legs per side in two alternating CSS animation groups
//  (cartoon-spider-leg-a / -b), and a power-core orb in the belly.
//  Symmetric so no dir-flip needed.

const SpiderBot = ({ id, eyeColor, bodyColor, darkColor }: BotProps) => {
  const W   = 14 * U;
  const H   = 22 * U;
  const CX  = 7 * U;
  const LL  = U * 2.8;   // left  body edge (leg attachment)
  const RL  = U * 11.2;  // right body edge

  const glow  = `url(#pw-glow-${id})`;
  const sGlow = `url(#pw-sglow-${id})`;
  const grad  = `url(#pw-grad-body-${id})`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <defs>
        {makeGlowFilter(id)}
        {makeSoftGlow(id)}
        {makeTopGrad(id, "body")}
      </defs>

      {makeRadarRing({ id, eyeColor })}

      {/* ── ANTENNAE ── */}
      <line x1={U * 5} y1={U * 4.5} x2={U * 3.5} y2={U * 1} stroke={eyeColor} strokeWidth={1.5} opacity={0.55} strokeLinecap="round" />
      <line x1={U * 9} y1={U * 4.5} x2={U * 10.5} y2={U * 1} stroke={eyeColor} strokeWidth={1.5} opacity={0.55} strokeLinecap="round" />
      <circle cx={U * 3.5} cy={U * 1} r={U * 0.55} fill={eyeColor} filter={glow} className="pixel-antenna-pulse" />
      <circle cx={U * 10.5} cy={U * 1} r={U * 0.55} fill={eyeColor} filter={glow} className="pixel-antenna-pulse" />

      {/* ── EYE STALKS ── */}
      <rect x={U * 4.3} y={U * 3.8} width={U * 0.8} height={U * 3} rx={U * 0.4} fill={bodyColor} />
      <rect x={U * 8.9} y={U * 3.8} width={U * 0.8} height={U * 3} rx={U * 0.4} fill={bodyColor} />

      {/* ── STALK EYES ── */}
      <circle cx={U * 4.7} cy={U * 3.6} r={U * 1.5} fill={darkColor} opacity={0.9} />
      <circle cx={U * 4.7} cy={U * 3.6} r={U * 1.0} fill={eyeColor} filter={glow} className="pixel-eye-glow" />
      <circle cx={U * 4.7 - 3} cy={U * 3.6 - 3} r={3} fill="white" opacity={0.72} />

      <circle cx={U * 9.3} cy={U * 3.6} r={U * 1.5} fill={darkColor} opacity={0.9} />
      <circle cx={U * 9.3} cy={U * 3.6} r={U * 1.0} fill={eyeColor} filter={glow} className="pixel-eye-glow" />
      <circle cx={U * 9.3 - 3} cy={U * 3.6 - 3} r={3} fill="white" opacity={0.72} />

      {/* ── CARAPACE ── */}
      <ellipse cx={CX} cy={U * 10.5} rx={U * 5.5} ry={U * 4} fill={bodyColor} />
      <ellipse cx={CX} cy={U * 10.5} rx={U * 5.5} ry={U * 4} fill={grad} />
      <ellipse cx={CX} cy={U * 8.8} rx={U * 4} ry={U * 1.3} fill="rgba(255,255,255,0.10)" />
      <line x1={U * 2.5} y1={U * 11} x2={U * 11.5} y2={U * 11} stroke={darkColor} strokeWidth={1.2} opacity={0.35} />
      <line x1={U * 3} y1={U * 12.5} x2={U * 11} y2={U * 12.5} stroke={darkColor} strokeWidth={1} opacity={0.25} />

      {/* ── POWER CORE ── */}
      <circle cx={CX} cy={U * 10.5} r={U * 1.3} fill={darkColor} opacity={0.9} />
      <circle cx={CX} cy={U * 10.5} r={U * 0.8} fill={eyeColor} filter={sGlow} className="pixel-status-pulse" />

      {/* ── MOUTH GRILL ── */}
      <rect x={U * 4.8} y={U * 13.2} width={U * 4.4} height={U * 1.0} rx={U * 0.5} fill={darkColor} opacity={0.75} />
      <rect x={U * 5.5} y={U * 13.28} width={U * 0.8} height={U * 0.82} fill={eyeColor} opacity={0.28} />
      <rect x={U * 6.8} y={U * 13.28} width={U * 0.8} height={U * 0.82} fill={eyeColor} opacity={0.28} />
      <rect x={U * 8.1} y={U * 13.28} width={U * 0.8} height={U * 0.82} fill={eyeColor} opacity={0.28} />

      {/* ── LEFT LEGS ── */}
      {/* front-left + back-left → group A */}
      <g className="cartoon-spider-leg-a" style={{ transformOrigin: `${LL}px ${U * 8.5}px` }}>
        <line x1={LL} y1={U * 8.5} x2={U * 0.2} y2={U * 13} stroke={bodyColor} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={U * 0.2} cy={U * 13} r={U * 0.5} fill={eyeColor} opacity={0.65} />
      </g>
      <g className="cartoon-spider-leg-a" style={{ transformOrigin: `${LL}px ${U * 12}px` }}>
        <line x1={LL} y1={U * 12} x2={U * 0} y2={U * 16.5} stroke={bodyColor} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={U * 0} cy={U * 16.5} r={U * 0.5} fill={eyeColor} opacity={0.65} />
      </g>
      {/* mid-left → group B */}
      <g className="cartoon-spider-leg-b" style={{ transformOrigin: `${LL}px ${U * 10.2}px` }}>
        <line x1={LL} y1={U * 10.2} x2={U * 0.3} y2={U * 14.8} stroke={bodyColor} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={U * 0.3} cy={U * 14.8} r={U * 0.5} fill={eyeColor} opacity={0.65} />
      </g>

      {/* ── RIGHT LEGS ── */}
      <g className="cartoon-spider-leg-a" style={{ transformOrigin: `${RL}px ${U * 8.5}px` }}>
        <line x1={RL} y1={U * 8.5} x2={U * 13.8} y2={U * 13} stroke={bodyColor} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={U * 13.8} cy={U * 13} r={U * 0.5} fill={eyeColor} opacity={0.65} />
      </g>
      <g className="cartoon-spider-leg-a" style={{ transformOrigin: `${RL}px ${U * 12}px` }}>
        <line x1={RL} y1={U * 12} x2={U * 14} y2={U * 16.5} stroke={bodyColor} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={U * 14} cy={U * 16.5} r={U * 0.5} fill={eyeColor} opacity={0.65} />
      </g>
      <g className="cartoon-spider-leg-b" style={{ transformOrigin: `${RL}px ${U * 10.2}px` }}>
        <line x1={RL} y1={U * 10.2} x2={U * 13.7} y2={U * 14.8} stroke={bodyColor} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={U * 13.7} cy={U * 14.8} r={U * 0.5} fill={eyeColor} opacity={0.65} />
      </g>

      <ellipse cx={CX} cy={H - 2} rx={U * 4.5} ry={U * 0.62} fill="rgba(0,0,0,0.22)" />
    </svg>
  );
};

// ── Bot selector ──────────────────────────────────────────────────────────────

const BOT_MAP: Record<Skin, (props: BotProps) => React.JSX.Element> = {
  blob: BlobBot,
  boxy: BoxyBot,
  rover: RoverBot,
  drone: DroneBot,
  spider: SpiderBot,
};

// ── Character wrapper ─────────────────────────────────────────────────────────

type CharacterProps = {
  def: CharDef;
  isMeeting: boolean;
  onRef: (el: HTMLDivElement | null) => void;
};

const Character = ({ def, isMeeting, onRef }: CharacterProps) => {
  const {
    label,
    thinking,
    thinkingDelay,
    meetText,
    eyeColor,
    scale,
    topPos,
    opacity,
    speed,
  } = def;
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
    gap: 4,
    opacity,
  };

  const labelStyle: CSSProperties = {
    fontSize: 8,
    fontFamily: "var(--font-mono, monospace)",
    color: eyeColor,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    opacity: 0.75,
    textShadow: `0 0 8px ${eyeColor}90`,
  };

  const BotSVG = BOT_MAP[def.skin];

  return (
    <div ref={onRef} style={outerStyle}>
      <div style={innerStyle}>
        {isMeeting ? (
          <MeetingBubble text={meetText} color={eyeColor} />
        ) : (
          thinking && (
            <ThinkingBubble
              text={thinking}
              delay={thinkingDelay}
              color={eyeColor}
            />
          )
        )}

        <div
          className={`${
            def.skin === "rover"
              ? "cartoon-rover-drive"
              : def.skin === "spider"
                ? "cartoon-spider-crawl"
                : "pixel-char-bob"
          }${isMeeting ? " pixel-meeting-char" : ""}`}
          style={{ color: eyeColor }}
        >
          <BotSVG
            id={def.id}
            eyeColor={def.eyeColor}
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

// ── Root component ────────────────────────────────────────────────────────────

export const PixelWorkers = () => {
  const [meetingRobots, setMeetingRobots] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const robotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastMeetRef = useRef<Map<string, number>>(new Map());

  const refCallbacks = useMemo(
    () =>
      new Map(
        CHARS.map(({ id }) => [
          id,
          (el: HTMLDivElement | null) => {
            if (el) robotRefs.current.set(id, el);
            else robotRefs.current.delete(id);
          },
        ]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const pathCSS = useMemo(() => buildPathKeyframes({ chars: CHARS }), []);

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
