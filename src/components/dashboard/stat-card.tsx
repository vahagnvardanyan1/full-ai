import { cn } from "@/lib/utils";
import { glassCard } from "@/lib/styles";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

export function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className={cn(glassCard, "p-5 flex items-start gap-4")}>
      <div className="size-10 rounded-lg bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.15)] flex items-center justify-center text-[#22c55e] shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-[0.72rem] font-medium text-[var(--text-muted)] uppercase tracking-wide">
          {label}
        </div>
        <div className="text-[1.5rem] font-bold font-[var(--font-display)] text-[var(--text)] tracking-tight mt-0.5">
          {value}
        </div>
      </div>
    </div>
  );
}
