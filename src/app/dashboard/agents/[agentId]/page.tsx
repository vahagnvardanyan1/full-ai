import { notFound } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { glassCard, pillBase, textGradientTitle } from "@/lib/styles";
import { AgentAvatar } from "@/components/agent-avatar";
import { Button } from "@/components/ui/button";
import { MOCK_AGENTS } from "@/lib/dashboard/mock-data";

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

  return (
    <div className="p-6 lg:p-10 max-w-[800px] mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/agents"
        className="inline-flex items-center gap-1.5 text-[0.78rem] text-[var(--text-muted)] no-underline hover:text-[var(--text)] transition-colors"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Agents
      </Link>

      {/* Profile header */}
      <div className={cn(glassCard, "p-6 flex flex-col sm:flex-row items-start gap-5")}>
        <AgentAvatar role={agent.role} size={72} />
        <div className="flex-1 min-w-0">
          <h1 className={cn("text-[1.5rem] font-bold font-[var(--font-display)] tracking-tight", textGradientTitle)}>
            {agent.name}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-[0.78rem] text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="#facc15" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {agent.rating} ({agent.reviewCount} reviews)
            </span>
            <span>{agent.tasksCompleted} tasks completed</span>
          </div>
          <p className="text-[0.82rem] text-[var(--text-muted)] leading-relaxed mt-3">
            {agent.description}
          </p>
        </div>
        <div className="sm:text-right shrink-0">
          <div className="text-[1.8rem] font-bold text-[var(--text)]">
            ${agent.price}
            <span className="text-[0.78rem] font-normal text-[var(--text-muted)]">/mo</span>
          </div>
          <Button className="mt-3 bg-gradient-to-br from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white rounded-lg shadow-[0_2px_12px_rgba(34,197,94,0.3)]">
            Hire Agent
          </Button>
        </div>
      </div>

      {/* Skills */}
      <div className={cn(glassCard, "p-6")}>
        <h2 className="text-[0.88rem] font-semibold text-[var(--text)] mb-4">Skills</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {agent.skills.map((skill) => {
            const color = SKILL_LEVEL_COLORS[skill.level] ?? "#6b7280";
            return (
              <div key={skill.name} className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--surface-border)]">
                <span className="text-[0.82rem] font-medium text-[var(--text)]">{skill.name}</span>
                <span className={cn(pillBase, "border")} style={{ color, borderColor: `${color}30`, background: `${color}10` }}>
                  {skill.level}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className={cn(glassCard, "p-6")}>
        <h2 className="text-[0.88rem] font-semibold text-[var(--text)] mb-4">Performance</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-[1.25rem] font-bold text-[var(--text)]">{agent.tasksCompleted}</div>
            <div className="text-[0.68rem] text-[var(--text-muted)]">Tasks Done</div>
          </div>
          <div>
            <div className="text-[1.25rem] font-bold text-[var(--text)]">{agent.rating}</div>
            <div className="text-[0.68rem] text-[var(--text-muted)]">Rating</div>
          </div>
          <div>
            <div className="text-[1.25rem] font-bold text-[var(--text)]">{agent.reviewCount}</div>
            <div className="text-[0.68rem] text-[var(--text-muted)]">Reviews</div>
          </div>
        </div>
      </div>
    </div>
  );
}
