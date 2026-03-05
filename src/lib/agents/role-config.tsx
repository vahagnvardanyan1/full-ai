"use client";

import type { LucideIcon } from "lucide-react";
import {
  Settings,
  ClipboardList,
  Code2,
  TestTube,
  Server,
  Search,
  Layout,
  FileCode,
  CheckCircle,
  FlaskConical,
  ShieldCheck,
  Gauge,
  Network,
  Bot,
} from "lucide-react";

import type { AgentRole } from "./types";

/**
 * Role display config: icon, color, label, and initial for UI.
 * To add a new agent: add an entry to CONFIG with color, Icon (from lucide-react), label, and initial.
 */
export interface RoleConfig {
  color: string;
  Icon: LucideIcon;
  label: string;
  /** 1–2 char initial for small badges/pips */
  initial: string;
}

/** Icons and colors per role. Add new agents by adding an entry with Icon (from lucide-react), color, label, initial. */
const CONFIG: Record<string, RoleConfig> = {
  orchestrator: {
    color: "#60a5fa",
    Icon: Settings,
    label: "Orchestrator",
    initial: "O",
  },
  product_manager: {
    color: "#a78bfa",
    Icon: ClipboardList,
    label: "Product Manager",
    initial: "PM",
  },
  frontend_developer: {
    color: "#34d399",
    Icon: Code2,
    label: "Frontend Developer",
    initial: "FE",
  },
  qa: {
    color: "#facc15",
    Icon: TestTube,
    label: "QA",
    initial: "QA",
  },
  devops: {
    color: "#f97316",
    Icon: Server,
    label: "DevOps",
    initial: "DO",
  },
  researcher: {
    color: "#06b6d4",
    Icon: Search,
    label: "Researcher",
    initial: "R",
  },
  architect: {
    color: "#8b5cf6",
    Icon: Layout,
    label: "Architect",
    initial: "A",
  },
  coder: {
    color: "#22c55e",
    Icon: FileCode,
    label: "Coder",
    initial: "C",
  },
  reviewer: {
    color: "#3b82f6",
    Icon: CheckCircle,
    label: "Reviewer",
    initial: "RV",
  },
  tester: {
    color: "#eab308",
    Icon: FlaskConical,
    label: "Tester",
    initial: "T",
  },
  security_architect: {
    color: "#ef4444",
    Icon: ShieldCheck,
    label: "Security Architect",
    initial: "S",
  },
  performance_engineer: {
    color: "#f59e0b",
    Icon: Gauge,
    label: "Performance Engineer",
    initial: "P",
  },
  coordinator: {
    color: "#ec4899",
    Icon: Network,
    label: "Coordinator",
    initial: "CO",
  },
};

/** Fallback for any role not in CONFIG (e.g. new/future agents). Always shows an icon. */
const DEFAULT_CONFIG: RoleConfig = {
  color: "#888",
  Icon: Bot,
  label: "Agent",
  initial: "?",
};

/** All role keys that have a custom icon/color. Add new agents here and to CONFIG. */
export const ALL_CONFIGURED_ROLES: string[] = Object.keys(CONFIG);

export function getRoleConfig(role: AgentRole | string): RoleConfig {
  return CONFIG[role] ?? { ...DEFAULT_CONFIG, label: formatRoleLabel(role), initial: getRoleInitial(role) };
}

export function getRoleColor(role: AgentRole | string): string {
  return getRoleConfig(role).color;
}

export function formatRoleLabel(role: string): string {
  return (
    CONFIG[role]?.label ??
    role
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export function getRoleInitial(role: string): string {
  return CONFIG[role]?.initial ?? (role.split("_").map((w) => w[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "?");
}

export const AGENT_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(CONFIG).map(([k, v]) => [k, v.color]),
);
