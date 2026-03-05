export interface AgentDisplayConfig {
  label: string;
  color: string;
}

const AGENT_DISPLAY_MAP: Record<string, AgentDisplayConfig> = {
  product_manager: { label: "Product Manager", color: "#f59e0b" },
  frontend_developer: { label: "Frontend Developer", color: "#3b82f6" },
  qa: { label: "QA Engineer", color: "#ef4444" },
  devops: { label: "DevOps Engineer", color: "#8b5cf6" },
  orchestrator: { label: "Orchestrator", color: "#22c55e" },
};

export const getAgentDisplay = (role: string): AgentDisplayConfig =>
  AGENT_DISPLAY_MAP[role] ?? { label: role, color: "#6b7280" };

export const getUptimeColor = (percent: number | null): string => {
  if (percent === null) return "#6b7280";
  if (percent < 20) return "#ef4444";
  if (percent < 50) return "#f59e0b";
  return "#22c55e";
};
