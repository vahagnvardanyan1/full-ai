"use client";

import { CSSProperties } from "react";

const wrapper: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "1rem",
  padding: "2rem",
};

const spinner: CSSProperties = {
  width: 40,
  height: 40,
  border: "3px solid var(--border)",
  borderTopColor: "var(--accent)",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const label: CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "0.875rem",
};

export function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div style={wrapper}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={spinner} />
      {message && <p style={label}>{message}</p>}
    </div>
  );
}
