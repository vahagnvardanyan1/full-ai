"use client";

import { CSSProperties, useRef, useEffect } from "react";
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
};

const PICSART_CDN = "https://cdn-cms-uploads.picsart.com/cms-uploads";

const AGENT_ANIMATIONS: Record<string, string> = {
  product_manager: `${PICSART_CDN}/c5d7d947-756b-4da6-bf6d-f5b3a830736c.mp4`,
  frontend_developer: `${PICSART_CDN}/7aab607b-d861-44d3-b5e0-d0233be39ff6.mp4`,
  qa: `${PICSART_CDN}/71fd37ab-de45-474e-89ce-edc39a060935.mp4`,
  devops: `${PICSART_CDN}/254781f4-6575-4cea-b2ac-18ad2e2fc7ca.mp4`,
  orchestrator: `${PICSART_CDN}/70483c73-3cd7-428f-ab17-95a56f4343d4.mp4`,
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

  const container: CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    flexShrink: 0,
  };

  const ringStyle: CSSProperties = {
    position: "absolute",
    inset: -2,
    borderRadius: "50%",
    border: `2px solid ${ringColor}`,
    opacity: showRing ? 1 : 0,
    transition: "opacity 0.3s, border-color 0.3s",
    animation: isWorking
      ? "avatar-ring-pulse 1.5s ease-in-out infinite"
      : undefined,
  };

  const wrapper: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: `${color}15`,
    border: `1.5px solid ${color}40`,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: isWorking
      ? `0 0 ${size * 0.4}px ${color}40`
      : status === "done"
        ? `0 0 ${size * 0.3}px #22c55e30`
        : status === "error"
          ? `0 0 ${size * 0.3}px #ef444430`
          : "none",
    transition: "box-shadow 0.3s ease",
  };

  const showBadge = status === "done" || status === "error";
  const badgeSize = Math.max(12, size * 0.35);

  return (
    <div style={container}>
      <div style={ringStyle} />

      <div style={wrapper}>
        {videoSrc ? (
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
        ) : (
          <span
            style={{
              fontSize: size * 0.45,
              fontWeight: 700,
              color: color,
              textTransform: "uppercase",
            }}
          >
            {(role[0] ?? "?").toUpperCase()}
          </span>
        )}
      </div>

      {showBadge && (
        <div
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: badgeSize,
            height: badgeSize,
            borderRadius: "50%",
            background: status === "done" ? "#22c55e" : "#ef4444",
            border: "2px solid var(--bg-secondary, #0f0f0f)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: badgeSize * 0.55,
            lineHeight: 1,
            color: "#fff",
            fontWeight: 700,
            animation: "avatar-badge-pop 0.3s ease-out",
          }}
        >
          {status === "done" ? "\u2713" : "!"}
        </div>
      )}
    </div>
  );
}
