import { notFound } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { pillBase } from "@/lib/styles";
import { AgentAvatar } from "@/components/agent-avatar";
import { Button } from "@/components/ui/button";
import { MOCK_AGENTS } from "@/lib/dashboard/mock-data";
import { FashionAgentInteraction } from "@/components/fashion/fashion-agent-interaction";

const SKILL_LEVEL_COLORS: Record<string, string> = {
  expert: "#22c55e",
  advanced: "#3b82f6",
  intermediate: "#f59e0b",
  beginner: "#6b7280",
};

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const agent = MOCK_AGENTS.find((a) => a.id === agentId);

  if (!agent) notFound();

  const isFashion = agent.id === "agent-fashion";

  // Fashion agent gets its own immersive layout
  if (isFashion) {
    return <FashionAgentPage agent={agent} />;
  }

  // Default layout for other agents — matches fashion page style
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Hero gradient header */}
      <div
        className="shrink-0 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(168,85,247,0.06) 50%, transparent 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 pt-3 sm:pt-4 pb-3 sm:pb-4">
          <BackLink />

          <div className="flex items-start gap-3 sm:gap-5 mt-2 sm:mt-3">
            {/* Avatar with glow ring */}
            <div className="relative shrink-0">
              <div
                className="absolute -inset-1.5 rounded-full opacity-40 blur-md"
                style={{ background: "linear-gradient(135deg, #22c55e, #a855f7)" }}
              />
              <div className="hidden sm:block"><AgentAvatar role={agent.role} size={64} /></div>
              <div className="sm:hidden"><AgentAvatar role={agent.role} size={44} /></div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <h1 className="text-[1.2rem] sm:text-[1.6rem] font-bold tracking-tight bg-gradient-to-r from-[#22c55e] to-[#a78bfa] bg-clip-text text-transparent">
                  {agent.name}
                </h1>
                <div className="flex items-center gap-1.5 text-[0.68rem] sm:text-[0.72rem] text-[var(--text-muted)]">
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="#facc15" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span>{agent.rating}</span>
                  <span className="opacity-50">·</span>
                  <span>{agent.tasksCompleted} tasks</span>
                </div>
              </div>
              <p className="text-[0.78rem] sm:text-[0.82rem] text-[var(--text-muted)] leading-relaxed mt-1 sm:mt-1.5 max-w-[600px] line-clamp-2 sm:line-clamp-none">
                {agent.description}
              </p>
            </div>

            {/* Price + Hire */}
            <div className="hidden sm:flex flex-col items-end gap-2 shrink-0 pt-1">
              <div className="flex items-baseline gap-1">
                <span className="text-[1.4rem] font-bold text-[var(--text)]">${agent.price}</span>
                <span className="text-[0.72rem] text-[var(--text-muted)]">/mo</span>
              </div>
              <Button className="bg-gradient-to-br from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white rounded-lg shadow-[0_2px_12px_rgba(34,197,94,0.3)] text-[0.78rem] px-4 py-1.5">
                Hire Agent
              </Button>
            </div>
          </div>

          {/* Mobile price row */}
          <div className="flex sm:hidden items-center justify-between mt-2 mb-1">
            <div className="flex items-baseline gap-1">
              <span className="text-[1.1rem] font-bold text-[var(--text)]">${agent.price}</span>
              <span className="text-[0.68rem] text-[var(--text-muted)]">/mo</span>
            </div>
            <Button className="bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-white rounded-lg text-[0.72rem] px-3 py-1">
              Hire Agent
            </Button>
          </div>

          {/* Stats + Skills row */}
          <div className="flex items-center gap-3 sm:gap-6 mt-2 sm:mt-3 flex-wrap">
            {[
              { label: "Tasks", value: agent.tasksCompleted.toString(), color: "#a78bfa" },
              { label: "Rating", value: agent.rating.toString(), color: "#f59e0b" },
              { label: "Reviews", value: agent.reviewCount.toString(), color: "#3b82f6" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-1">
                <span className="text-[0.82rem] sm:text-[0.88rem] font-bold" style={{ color: stat.color }}>{stat.value}</span>
                <span className="text-[0.55rem] sm:text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wide">{stat.label}</span>
              </div>
            ))}
            <div className="hidden sm:block w-px h-4 bg-[var(--surface-border)]" />
            {agent.skills.map((skill) => {
              const color = SKILL_LEVEL_COLORS[skill.level] ?? "#6b7280";
              return (
                <span
                  key={skill.name}
                  className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[0.68rem] font-medium bg-[var(--surface-raised)] border border-[var(--surface-border)]"
                >
                  <span className="text-[var(--text)]">{skill.name}</span>
                  <span
                    className={cn(pillBase, "border text-[0.5rem] py-0")}
                    style={{ color, borderColor: `${color}30`, background: `${color}10` }}
                  >
                    {skill.level}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main content — fills remaining viewport */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-10 py-4 max-w-[1280px] mx-auto w-full">
        <div className="text-center py-20 text-[var(--text-muted)] text-[0.88rem]">
          Agent workspace coming soon...
        </div>
      </div>
    </div>
  );
}

// ── Fashion-specific page ──────────────────────────────

interface AgentData {
  id: string;
  name: string;
  role: string;
  description: string;
  rating: number;
  reviewCount: number;
  tasksCompleted: number;
  price: number;
  skills: { name: string; level: string }[];
}

function FashionAgentPage({ agent }: { agent: AgentData }) {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Hero gradient header */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(168,85,247,0.06) 50%, transparent 100%)",
        }}
      >
        {/* Subtle decorative dots */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 pt-3 sm:pt-4 pb-3 sm:pb-4">
          <BackLink />

          {/* Compact header row */}
          <div className="flex items-start gap-3 sm:gap-5 mt-2 sm:mt-3">
            {/* Avatar with glow ring */}
            <div className="relative shrink-0">
              <div
                className="absolute -inset-1.5 rounded-full opacity-40 blur-md"
                style={{ background: "linear-gradient(135deg, #22c55e, #a855f7)" }}
              />
              <div className="hidden sm:block"><AgentAvatar role={agent.role} size={64} /></div>
              <div className="sm:hidden"><AgentAvatar role={agent.role} size={44} /></div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <h1 className="text-[1.2rem] sm:text-[1.6rem] font-bold tracking-tight bg-gradient-to-r from-[#22c55e] to-[#a78bfa] bg-clip-text text-transparent">
                  {agent.name}
                </h1>
                <div className="flex items-center gap-1.5 text-[0.68rem] sm:text-[0.72rem] text-[var(--text-muted)]">
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="#facc15" stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span>{agent.rating}</span>
                  <span className="opacity-50">·</span>
                  <span>{agent.tasksCompleted} styled</span>
                </div>
              </div>
              <p className="text-[0.78rem] sm:text-[0.82rem] text-[var(--text-muted)] leading-relaxed mt-1 sm:mt-1.5 max-w-[600px] line-clamp-2 sm:line-clamp-none">
                {agent.description}
              </p>
            </div>

            {/* Price + Retailer badges */}
            <div className="hidden sm:flex flex-col items-end gap-2 shrink-0 pt-1">
              <div className="flex items-baseline gap-1">
                <span className="text-[1.4rem] font-bold text-[var(--text)]">${agent.price}</span>
                <span className="text-[0.72rem] text-[var(--text-muted)]">/mo</span>
              </div>
              <div className="flex items-center gap-1.5">
                {["Zara", "Bershka", "M. Dutti"].map((brand) => (
                  <span
                    key={brand}
                    className="px-2 py-0.5 rounded-md text-[0.58rem] font-semibold uppercase tracking-wide bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-muted)]"
                  >
                    {brand}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile price + brands row */}
          <div className="flex sm:hidden items-center justify-between mt-2 mb-1">
            <div className="flex items-baseline gap-1">
              <span className="text-[1.1rem] font-bold text-[var(--text)]">${agent.price}</span>
              <span className="text-[0.68rem] text-[var(--text-muted)]">/mo</span>
            </div>
            <div className="flex items-center gap-1">
              {["Zara", "Bershka", "M. Dutti"].map((brand) => (
                <span
                  key={brand}
                  className="px-1.5 py-0.5 rounded text-[0.5rem] font-semibold uppercase tracking-wide bg-[var(--surface-raised)] border border-[var(--surface-border)] text-[var(--text-muted)]"
                >
                  {brand}
                </span>
              ))}
            </div>
          </div>

          {/* Stats + Skills row */}
          <div className="flex items-center gap-3 sm:gap-6 mt-2 sm:mt-3 flex-wrap">
            {[
              { label: "Outfits", value: agent.tasksCompleted.toString(), color: "#a78bfa" },
              { label: "Rating", value: agent.rating.toString(), color: "#f59e0b" },
              { label: "Reviews", value: agent.reviewCount.toString(), color: "#3b82f6" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-1">
                <span className="text-[0.82rem] sm:text-[0.88rem] font-bold" style={{ color: stat.color }}>{stat.value}</span>
                <span className="text-[0.55rem] sm:text-[0.6rem] text-[var(--text-muted)] uppercase tracking-wide">{stat.label}</span>
              </div>
            ))}
            <div className="hidden sm:block w-px h-4 bg-[var(--surface-border)]" />
            {agent.skills.map((skill) => {
              const color = SKILL_LEVEL_COLORS[skill.level] ?? "#6b7280";
              return (
                <span
                  key={skill.name}
                  className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[0.68rem] font-medium bg-[var(--surface-raised)] border border-[var(--surface-border)]"
                >
                  <span className="text-[var(--text)]">{skill.name}</span>
                  <span
                    className={cn(pillBase, "border text-[0.5rem] py-0")}
                    style={{ color, borderColor: `${color}30`, background: `${color}10` }}
                  >
                    {skill.level}
                  </span>
                </span>
              );
            })}
          </div>
        </div>

      </div>

      {/* Main content — fills remaining viewport */}
      <div className="flex-1 min-h-0 px-2 sm:px-4 lg:px-6 py-2 sm:py-3">
        <FashionAgentInteraction />
      </div>
    </div>
  );
}

// ── Shared components ──────────────────────────────────

function BackLink() {
  return (
    <Link
      href="/dashboard/agents"
      className="inline-flex items-center gap-1.5 text-[0.78rem] text-[var(--text-muted)] no-underline hover:text-[var(--text)] transition-colors"
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Back to Agents
    </Link>
  );
}

