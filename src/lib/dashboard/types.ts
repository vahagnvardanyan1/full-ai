import type { AgentRole } from "@/lib/agents/types";

export interface ISkill {
  name: string;
  level: "beginner" | "intermediate" | "advanced" | "expert";
}

export interface IPricingTier {
  name: string;
  price: number;
  period: "month";
  features: string[];
  highlighted?: boolean;
}

export interface IAgent {
  id: string;
  name: string;
  role: AgentRole | string;
  category: string;
  avatar?: string;
  description: string;
  skills: ISkill[];
  price: number;
  period: "month";
  rating: number;
  reviewCount: number;
  tasksCompleted: number;
  status: "available" | "busy" | "offline";
}

export interface ITeam {
  id: string;
  name: string;
  category: string;
  description: string;
  logo?: string;
  agents: IAgent[];
  rating: number;
  reviewCount: number;
  services: string[];
  pricing: IPricingTier[];
}

export interface IWorkspaceMember {
  agentId: string;
  name: string;
  role: AgentRole;
  status: "active" | "idle" | "offline";
  currentTask: string | null;
  color: string;
}

export interface IWorkspaceTeam {
  teamId: string;
  name: string;
  members: IWorkspaceMember[];
  activeSince: string;
}

export interface IDashboardStats {
  activeAgents: number;
  tasksCompleted: number;
  activeTeams: number;
  uptime: string;
}
