import { notFound } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { glassCard, pillBase, textGradientTitle } from "@/lib/styles";
import { AgentAvatar } from "@/components/agent-avatar";
import { Button } from "@/components/ui/button";
import { MOCK_TEAMS } from "@/lib/dashboard/mock-data";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const team = MOCK_TEAMS.find((t) => t.id === teamId);

  if (!team) notFound();

  return (
    <div className="p-6 lg:p-10 max-w-[900px] mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/teams"
        className="inline-flex items-center gap-1.5 text-[0.78rem] text-[var(--text-muted)] no-underline hover:text-[var(--text)] transition-colors"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Teams
      </Link>

      {/* Team header */}
      <div className={cn(glassCard, "p-6")}>
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <div className="size-16 rounded-xl bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.15)] flex items-center justify-center text-[#22c55e] font-bold text-[1.4rem] shrink-0">
            {team.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className={cn("text-[1.5rem] font-bold font-[var(--font-display)] tracking-tight", textGradientTitle)}>
              {team.name}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className={cn(pillBase, "bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--surface-border)]")}>
                {team.category}
              </span>
              <span className="flex items-center gap-1 text-[0.75rem] text-[var(--text-muted)]">
                <svg width={12} height={12} viewBox="0 0 24 24" fill="#facc15" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {team.rating} ({team.reviewCount} reviews)
              </span>
              <span className="text-[0.75rem] text-[var(--text-muted)]">
                {team.agents.length} agents
              </span>
            </div>
            <p className="text-[0.82rem] text-[var(--text-muted)] leading-relaxed mt-3">
              {team.description}
            </p>
          </div>
        </div>
      </div>

      {/* Pricing tiers */}
      <div>
        <h2 className="text-[0.95rem] font-semibold text-[var(--text)] mb-4">Pricing Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {team.pricing.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                glassCard,
                "p-5 flex flex-col",
                tier.highlighted && "border-[rgba(34,197,94,0.3)] shadow-[0_0_24px_rgba(34,197,94,0.06)]",
              )}
            >
              {tier.highlighted && (
                <span className="text-[0.6rem] font-bold uppercase tracking-wider text-[#22c55e] mb-2">
                  Most Popular
                </span>
              )}
              <div className="text-[0.82rem] font-semibold text-[var(--text)]">{tier.name}</div>
              <div className="mt-2">
                <span className="text-[1.6rem] font-bold text-[var(--text)]">${tier.price}</span>
                <span className="text-[0.75rem] text-[var(--text-muted)]">/mo</span>
              </div>
              <ul className="mt-4 space-y-2 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-[0.75rem] text-[var(--text-muted)]">
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className={cn(
                  "mt-5 w-full rounded-lg",
                  tier.highlighted
                    ? "bg-gradient-to-br from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-white shadow-[0_2px_12px_rgba(34,197,94,0.3)]"
                    : "",
                )}
                variant={tier.highlighted ? "default" : "outline"}
              >
                Get Started
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Services */}
      <div className={cn(glassCard, "p-6")}>
        <h2 className="text-[0.88rem] font-semibold text-[var(--text)] mb-4">Services</h2>
        <div className="flex flex-wrap gap-2">
          {team.services.map((service) => (
            <span
              key={service}
              className={cn(pillBase, "bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--surface-border)] text-[0.7rem] px-3 py-1")}
            >
              {service}
            </span>
          ))}
        </div>
      </div>

      {/* Agent roster */}
      <div className={cn(glassCard, "p-6")}>
        <h2 className="text-[0.88rem] font-semibold text-[var(--text)] mb-4">
          Team Roster ({team.agents.length} agents)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {team.agents.map((agent, i) => (
            <Link
              key={`${agent.id}-${i}`}
              href={`/dashboard/agents/${agent.id}`}
              className="no-underline"
            >
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--surface-border)] hover:border-[rgba(34,197,94,0.2)] transition-colors">
                <AgentAvatar role={agent.role} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="text-[0.78rem] font-medium text-[var(--text)] truncate">
                    {agent.name}
                  </div>
                  <div className="text-[0.65rem] text-[var(--text-muted)]">
                    ${agent.price}/mo
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
