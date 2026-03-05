export const SIDEBAR_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
  { label: "Agents Marketplace", href: "/dashboard/agents", icon: "bot" },
  { label: "Team Marketplace", href: "/dashboard/teams", icon: "users" },
  { label: "My Workspace", href: "/dashboard/workspace", icon: "briefcase" },
  { label: "Settings", href: "/dashboard/settings", icon: "settings" },
] as const;

export const AGENT_CATEGORIES = [
  "All",
  "Engineering",
  "Design",
  "Management",
  "Quality",
  "Operations",
  "Analytics",
  "Lifestyle",
] as const;

export const TEAM_CATEGORIES = [
  "All",
  "IT",
  "Design",
  "Marketing",
  "Consulting",
] as const;
