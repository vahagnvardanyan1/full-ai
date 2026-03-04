import type {
  IAgent,
  ITeam,
  IWorkspaceTeam,
  IDashboardStats,
} from "./types";

export const MOCK_AGENTS: IAgent[] = [
  {
    id: "agent-pm",
    name: "Product Manager",
    role: "product_manager",
    category: "Management",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=PM-Alpha",
    description:
      "Defines product vision, writes specs, and prioritizes the backlog. Plans sprints and keeps the team aligned on goals.",
    skills: [
      { name: "Product Strategy", level: "expert" },
      { name: "Sprint Planning", level: "expert" },
      { name: "User Stories", level: "advanced" },
      { name: "Roadmapping", level: "advanced" },
    ],
    price: 35,
    period: "month",
    rating: 4.9,
    reviewCount: 156,
    tasksCompleted: 412,
    status: "available",
  },
  {
    id: "agent-designer",
    name: "UI/UX Designer",
    role: "frontend_developer",
    category: "Design",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=Design-Pixel",
    description:
      "Creates wireframes, prototypes, and polished UI designs. Builds consistent design systems with accessible, beautiful interfaces.",
    skills: [
      { name: "Figma", level: "expert" },
      { name: "Design Systems", level: "expert" },
      { name: "Prototyping", level: "advanced" },
      { name: "Accessibility", level: "advanced" },
    ],
    price: 27,
    period: "month",
    rating: 4.8,
    reviewCount: 143,
    tasksCompleted: 356,
    status: "available",
  },
  {
    id: "agent-frontend",
    name: "Frontend Engineer",
    role: "frontend_developer",
    category: "Engineering",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=FE-React",
    description:
      "Builds web interfaces with React, handles state and API integration. Ships pixel-perfect, performant UIs with clean code.",
    skills: [
      { name: "React", level: "expert" },
      { name: "TypeScript", level: "expert" },
      { name: "Next.js", level: "advanced" },
      { name: "Tailwind CSS", level: "expert" },
    ],
    price: 29,
    period: "month",
    rating: 4.8,
    reviewCount: 127,
    tasksCompleted: 342,
    status: "available",
  },
  {
    id: "agent-mobile",
    name: "Mobile Engineer",
    role: "frontend_developer",
    category: "Engineering",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=Mobile-Swift",
    description:
      "Writes native iOS/Android code and delivers mobile apps. Experienced with Swift, Kotlin, and cross-platform frameworks.",
    skills: [
      { name: "Swift", level: "expert" },
      { name: "Kotlin", level: "advanced" },
      { name: "React Native", level: "advanced" },
      { name: "Flutter", level: "intermediate" },
    ],
    price: 32,
    period: "month",
    rating: 4.7,
    reviewCount: 94,
    tasksCompleted: 218,
    status: "available",
  },
  {
    id: "agent-backend",
    name: "Backend Engineer",
    role: "frontend_developer",
    category: "Engineering",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=BE-Node",
    description:
      "Designs APIs, builds microservices, and manages databases. Experienced with Node.js, PostgreSQL, and distributed systems.",
    skills: [
      { name: "Node.js", level: "expert" },
      { name: "PostgreSQL", level: "advanced" },
      { name: "GraphQL", level: "advanced" },
      { name: "Redis", level: "intermediate" },
    ],
    price: 29,
    period: "month",
    rating: 4.7,
    reviewCount: 112,
    tasksCompleted: 298,
    status: "busy",
  },
  {
    id: "agent-qa",
    name: "QA Engineer",
    role: "qa",
    category: "Quality",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=QA-Bug",
    description:
      "Tests features, writes automated tests, and reports bugs. Ensures production-ready output with comprehensive testing pipelines.",
    skills: [
      { name: "Playwright", level: "expert" },
      { name: "Jest", level: "advanced" },
      { name: "Cypress", level: "advanced" },
      { name: "Test Strategy", level: "expert" },
    ],
    price: 25,
    period: "month",
    rating: 4.7,
    reviewCount: 98,
    tasksCompleted: 281,
    status: "available",
  },
  {
    id: "agent-devops",
    name: "DevOps Engineer",
    role: "devops",
    category: "Operations",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=DevOps-Cloud",
    description:
      "Manages CI/CD pipelines, infrastructure, and deployments. Ensures zero-downtime releases with monitoring and alerting.",
    skills: [
      { name: "Docker", level: "expert" },
      { name: "CI/CD", level: "expert" },
      { name: "AWS", level: "advanced" },
      { name: "Kubernetes", level: "advanced" },
    ],
    price: 32,
    period: "month",
    rating: 4.6,
    reviewCount: 89,
    tasksCompleted: 267,
    status: "available",
  },
  {
    id: "agent-data",
    name: "Data Analyst",
    role: "product_manager",
    category: "Analytics",
    avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=Data-Chart",
    description:
      "Analyzes metrics, builds dashboards, and provides insights. Turns raw data into actionable business intelligence.",
    skills: [
      { name: "SQL", level: "expert" },
      { name: "Python", level: "advanced" },
      { name: "Tableau", level: "advanced" },
      { name: "Data Modeling", level: "expert" },
    ],
    price: 30,
    period: "month",
    rating: 4.8,
    reviewCount: 76,
    tasksCompleted: 194,
    status: "available",
  },
];

export const MOCK_TEAMS: ITeam[] = [
  {
    id: "team-cortexdev",
    name: "CortexDev Labs",
    category: "IT",
    description:
      "Full-service AI development team specializing in end-to-end software delivery. From architecture to deployment, CortexDev Labs handles the entire development lifecycle with precision and speed.",
    agents: [
      MOCK_AGENTS[0], // PM
      MOCK_AGENTS[1], // Designer
      MOCK_AGENTS[2], // Frontend
      MOCK_AGENTS[3], // Mobile
      MOCK_AGENTS[4], // Backend
      MOCK_AGENTS[5], // QA
      MOCK_AGENTS[6], // DevOps
      MOCK_AGENTS[7], // Data Analyst
    ],
    rating: 4.7,
    reviewCount: 342,
    services: [
      "Full-stack development",
      "CI/CD pipeline setup",
      "QA automation",
      "Architecture review",
      "Performance optimization",
    ],
    pricing: [
      {
        name: "Starter",
        price: 499,
        period: "month",
        features: [
          "4 AI agents",
          "Up to 100 tasks/month",
          "Basic support",
          "Standard pipeline",
        ],
      },
      {
        name: "Professional",
        price: 799,
        period: "month",
        features: [
          "6 AI agents",
          "Unlimited tasks",
          "Priority support",
          "Custom pipeline",
          "Code review",
        ],
        highlighted: true,
      },
      {
        name: "Enterprise",
        price: 1299,
        period: "month",
        features: [
          "8 AI agents",
          "Unlimited tasks",
          "24/7 support",
          "Custom pipeline",
          "Dedicated PM",
          "SLA guarantee",
        ],
      },
    ],
  },
  {
    id: "team-amplify",
    name: "Amplify AI Agency",
    category: "Marketing",
    description:
      "AI-powered marketing team that creates compelling content, manages campaigns, and optimizes conversion funnels. Amplify brings data-driven marketing strategies to life.",
    agents: [
      MOCK_AGENTS[0], // PM
      MOCK_AGENTS[1], // Designer
      MOCK_AGENTS[2], // Frontend
      MOCK_AGENTS[5], // QA
    ],
    rating: 4.5,
    reviewCount: 198,
    services: [
      "Landing page creation",
      "A/B testing",
      "SEO optimization",
      "Content strategy",
      "Analytics setup",
    ],
    pricing: [
      {
        name: "Starter",
        price: 399,
        period: "month",
        features: [
          "2 AI agents",
          "Up to 50 tasks/month",
          "Basic analytics",
          "Email support",
        ],
      },
      {
        name: "Growth",
        price: 699,
        period: "month",
        features: [
          "4 AI agents",
          "Unlimited tasks",
          "Advanced analytics",
          "Priority support",
          "A/B testing",
        ],
        highlighted: true,
      },
      {
        name: "Scale",
        price: 999,
        period: "month",
        features: [
          "6 AI agents",
          "Unlimited tasks",
          "Custom dashboards",
          "Dedicated strategist",
          "White-label reports",
        ],
      },
    ],
  },
  {
    id: "team-pixelcraft",
    name: "PixelCraft Studio",
    category: "Design",
    description:
      "Design-first AI team that delivers stunning interfaces, brand identities, and design systems. From wireframes to production-ready assets, PixelCraft handles it all.",
    agents: [
      MOCK_AGENTS[0], // PM
      MOCK_AGENTS[1], // Designer
      MOCK_AGENTS[2], // Frontend
    ],
    rating: 4.8,
    reviewCount: 267,
    services: [
      "UI/UX design",
      "Design systems",
      "Brand identity",
      "Prototyping",
      "Design-to-code",
    ],
    pricing: [
      {
        name: "Starter",
        price: 349,
        period: "month",
        features: [
          "2 AI agents",
          "Up to 40 tasks/month",
          "Figma deliverables",
          "Email support",
        ],
      },
      {
        name: "Studio",
        price: 649,
        period: "month",
        features: [
          "3 AI agents",
          "Unlimited tasks",
          "Design system setup",
          "Priority support",
          "Code handoff",
        ],
        highlighted: true,
      },
      {
        name: "Agency",
        price: 999,
        period: "month",
        features: [
          "4 AI agents",
          "Unlimited tasks",
          "Brand guidelines",
          "Dedicated designer",
          "Motion design",
        ],
      },
    ],
  },
  {
    id: "team-dataforge",
    name: "DataForge Analytics",
    category: "Consulting",
    description:
      "Data-driven AI consulting team that builds dashboards, automates reporting, and delivers actionable insights. Transform raw data into strategic decisions.",
    agents: [
      MOCK_AGENTS[0], // PM
      MOCK_AGENTS[4], // Backend
      MOCK_AGENTS[7], // Data Analyst
    ],
    rating: 4.6,
    reviewCount: 154,
    services: [
      "Dashboard creation",
      "Data pipeline setup",
      "KPI tracking",
      "Predictive analytics",
      "Report automation",
    ],
    pricing: [
      {
        name: "Insights",
        price: 449,
        period: "month",
        features: [
          "2 AI agents",
          "Up to 60 tasks/month",
          "3 dashboards",
          "Email support",
        ],
      },
      {
        name: "Intelligence",
        price: 799,
        period: "month",
        features: [
          "3 AI agents",
          "Unlimited tasks",
          "Unlimited dashboards",
          "Priority support",
          "Custom integrations",
        ],
        highlighted: true,
      },
      {
        name: "Enterprise",
        price: 1199,
        period: "month",
        features: [
          "4 AI agents",
          "Unlimited everything",
          "Predictive models",
          "24/7 support",
          "SLA guarantee",
        ],
      },
    ],
  },
  {
    id: "team-shieldops",
    name: "ShieldOps Security",
    category: "IT",
    description:
      "Security-focused DevOps team that hardens infrastructure, automates compliance, and runs penetration tests. Keep your systems secure and your deployments bulletproof.",
    agents: [
      MOCK_AGENTS[4], // Backend
      MOCK_AGENTS[5], // QA
      MOCK_AGENTS[6], // DevOps
    ],
    rating: 4.9,
    reviewCount: 89,
    services: [
      "Security audits",
      "CI/CD hardening",
      "Compliance automation",
      "Incident response",
      "Infrastructure monitoring",
    ],
    pricing: [
      {
        name: "Shield",
        price: 599,
        period: "month",
        features: [
          "2 AI agents",
          "Monthly audit",
          "Basic monitoring",
          "Email support",
        ],
      },
      {
        name: "Fortress",
        price: 999,
        period: "month",
        features: [
          "3 AI agents",
          "Weekly audits",
          "24/7 monitoring",
          "Priority support",
          "Incident playbooks",
        ],
        highlighted: true,
      },
      {
        name: "Citadel",
        price: 1599,
        period: "month",
        features: [
          "4 AI agents",
          "Continuous audits",
          "SOC2 compliance",
          "Dedicated engineer",
          "SLA guarantee",
        ],
      },
    ],
  },
];

export const MOCK_WORKSPACE: IWorkspaceTeam[] = [
  {
    teamId: "team-default",
    name: "Default Team",
    activeSince: "2025-12-01",
    members: [
      {
        agentId: "agent-pm",
        name: "Product Manager",
        role: "product_manager",
        status: "active",
        currentTask: "Planning sprint backlog",
        color: "#f59e0b",
      },
      {
        agentId: "agent-frontend",
        name: "Frontend Engineer",
        role: "frontend_developer",
        status: "active",
        currentTask: "Building dashboard UI",
        color: "#3b82f6",
      },
      {
        agentId: "agent-qa",
        name: "QA Engineer",
        role: "qa",
        status: "idle",
        currentTask: null,
        color: "#ef4444",
      },
      {
        agentId: "agent-devops",
        name: "DevOps Engineer",
        role: "devops",
        status: "active",
        currentTask: "Configuring CI pipeline",
        color: "#8b5cf6",
      },
    ],
  },
];

export const MOCK_STATS: IDashboardStats = {
  activeAgents: 4,
  tasksCompleted: 1247,
  activeTeams: 1,
  uptime: "99.9%",
};
