import { cn } from "@/lib/utils";
import { glassCard } from "@/lib/styles";
import { AgentAvatar } from "@/components/agent-avatar";
import type { IWorkspaceMember } from "@/lib/dashboard/types";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "Working", color: "#22c55e" },
  idle: { label: "Idle", color: "#6b7280" },
  offline: { label: "Offline", color: "#4b5563" },
};

export function WorkspaceMemberCard({ member }: { member: IWorkspaceMember }) {
  const status = STATUS_MAP[member.status] ?? STATUS_MAP.idle;

  return (
    <div
      className={cn(glassCard, "p-4 flex items-center gap-3")}
      style={{ borderLeft: `3px solid ${member.color}` }}
    >
      <AgentAvatar
        role={member.role}
        size={40}
        status={member.status === "active" ? "working" : "idle"}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[0.82rem] font-semibold text-[var(--text)] truncate">
          {member.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="inline-block size-1.5 rounded-full"
            style={{ background: status.color }}
          />
          <span className="text-[0.68rem] text-[var(--text-muted)]">
            {status.label}
          </span>
        </div>
        {member.currentTask && (
          <div className="text-[0.68rem] text-[var(--text-muted)] mt-1 truncate">
            {member.currentTask}
          </div>
        )}
      </div>
    </div>
  );
}
