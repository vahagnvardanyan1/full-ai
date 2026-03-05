"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { AgentRole } from "@/lib/agents/types";

export type AvatarStatus = "idle" | "working" | "done" | "error";

interface AgentAvatarProps {
  role: AgentRole | string;
  size?: number;
  status?: AvatarStatus;
}

const AGENT_COLORS: Record<string, string> = {
  product_manager: "#a78bfa",
  frontend_developer: "#34d399",
  qa: "#facc15",
  devops: "#f97316",
  orchestrator: "#60a5fa",
  fashion_stylist: "#ec4899",
};

const PICSART_CDN = "https://cdn-cms-uploads.picsart.com/cms-uploads";

const AGENT_ANIMATIONS: Record<string, string> = {
  product_manager: `${PICSART_CDN}/c5d7d947-756b-4da6-bf6d-f5b3a830736c.mp4`,
  frontend_developer: `${PICSART_CDN}/7aab607b-d861-44d3-b5e0-d0233be39ff6.mp4`,
  qa: `${PICSART_CDN}/71fd37ab-de45-474e-89ce-edc39a060935.mp4`,
  devops: `${PICSART_CDN}/254781f4-6575-4cea-b2ac-18ad2e2fc7ca.mp4`,
  orchestrator: `${PICSART_CDN}/70483c73-3cd7-428f-ab17-95a56f4343d4.mp4`,
  fashion_stylist: `${PICSART_CDN}/5ea34d1d-04be-42f7-93c2-010745c03f0a.mp4`,
};

const STATUS_RING_COLORS: Record<AvatarStatus, string> = {
  idle: "transparent",
  working: "#3b82f6",
  done: "#22c55e",
  error: "#ef4444",
};

const STATUS_SPEED: Record<AvatarStatus, number> = {
  idle: 0.7,
  working: 1.6,
  done: 1,
  error: 0.5,
};

export function AgentAvatar({
  role,
  size = 54,
  status = "idle",
}: AgentAvatarProps) {
  const color = AGENT_COLORS[role] ?? "#888";
  const videoSrc = AGENT_ANIMATIONS[role];
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = STATUS_SPEED[status];
    }
  }, [status]);

  const ringColor = STATUS_RING_COLORS[status];
  const isWorking = status === "working";
  const showRing = status !== "idle";
  const showBadge = status === "done" || status === "error";
  const badgeSize = Math.max(12, size * 0.35);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Status ring */}
      <div
        className={cn(
          "absolute -inset-0.5 rounded-full transition-[opacity,border-color] duration-300",
          isWorking && "animate-avatar-ring-pulse",
        )}
        style={{
          border: `2px solid ${ringColor}`,
          opacity: showRing ? 1 : 0,
        }}
      />

      {/* Avatar wrapper */}
      <div
        className="rounded-full overflow-hidden flex items-center justify-center transition-shadow duration-300"
        style={{
          width: size,
          height: size,
          background: `${color}15`,
          border: `1.5px solid ${color}40`,
          boxShadow: isWorking
            ? `0 0 ${size * 0.4}px ${color}40`
            : status === "done"
              ? `0 0 ${size * 0.3}px #22c55e30`
              : status === "error"
                ? `0 0 ${size * 0.3}px #ef444430`
                : "none",
        }}
      >
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            className="pointer-events-none object-cover"
            style={{
              width: size * 1.2,
              height: size * 1.2,
            }}
          />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            style={{ width: size * 0.55, height: size * 0.55 }}
          >
            {/* Antenna */}
            <line x1="12" y1="2" x2="12" y2="5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="1.5" r="1" fill={color} />
            {/* Head */}
            <rect x="5" y="5" width="14" height="10" rx="3" stroke={color} strokeWidth="1.5" fill={`${color}20`} />
            {/* Eyes */}
            <circle cx="9" cy="10" r="1.8" fill={color} />
            <circle cx="15" cy="10" r="1.8" fill={color} />
            {/* Mouth */}
            <line x1="9.5" y1="13" x2="14.5" y2="13" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
            {/* Body */}
            <rect x="7" y="16" width="10" height="5" rx="2" stroke={color} strokeWidth="1.5" fill={`${color}15`} />
            {/* Arms */}
            <line x1="5" y1="17" x2="3" y2="19" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="19" y1="17" x2="21" y2="19" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* Status badge */}
      {showBadge && (
        <div
          className="absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center text-white font-bold animate-avatar-badge-pop"
          style={{
            width: badgeSize,
            height: badgeSize,
            background: status === "done" ? "#22c55e" : "#ef4444",
            border: "2px solid var(--bg-secondary, #0f0f0f)",
            fontSize: badgeSize * 0.55,
            lineHeight: 1,
          }}
        >
          {status === "done" ? "\u2713" : "!"}
        </div>
      )}
    </div>
  );
}
