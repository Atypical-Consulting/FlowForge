import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { useInsightsStore } from "../insightsStore";
import type { ContributorStats } from "../types";
import { GravatarAvatar } from "./GravatarAvatar";

interface Props {
  contributors: ContributorStats[];
  totalCommits: number;
}

const MAX_SHOWN = 15;

export function ContributorBreakdown({ contributors, totalCommits }: Props) {
  const selectedContributor = useInsightsStore((s) => s.selectedContributor);
  const selectContributor = useInsightsStore((s) => s.selectContributor);

  if (contributors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-ctp-subtext0">
        <Users className="mb-2 h-6 w-6 opacity-40" />
        <span className="text-xs">No contributor data</span>
      </div>
    );
  }

  const visible = contributors.slice(0, MAX_SHOWN);
  const remaining = contributors.length - MAX_SHOWN;

  return (
    <div className="max-h-80 overflow-y-auto">
      <div className="flex flex-col gap-1">
        {visible.map((contributor, index) => {
          const isSelected = selectedContributor === contributor.email;
          return (
            <button
              key={contributor.email}
              onClick={() => {
                selectContributor(isSelected ? null : contributor.email);
              }}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                isSelected
                  ? "bg-ctp-blue/10 border border-ctp-blue/20"
                  : "hover:bg-ctp-surface0/50 border border-transparent"
              }`}
            >
              <GravatarAvatar
                email={contributor.email}
                name={contributor.name}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs font-medium text-ctp-text">
                    {contributor.name}
                  </span>
                  <span className="ml-2 shrink-0 text-[10px] text-ctp-subtext0">
                    {contributor.commitCount} commit
                    {contributor.commitCount !== 1 ? "s" : ""}
                  </span>
                </div>
                {/* Activity bar */}
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ctp-surface0/60">
                  <motion.div
                    className="h-full rounded-full bg-ctp-blue"
                    initial={{ width: 0 }}
                    animate={{ width: `${contributor.percentage}%` }}
                    transition={{ duration: 0.5, delay: index * 0.03 }}
                  />
                </div>
                <span className="mt-0.5 text-[10px] text-ctp-subtext0">
                  {contributor.percentage.toFixed(1)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {remaining > 0 && (
        <p className="mt-2 text-center text-[10px] text-ctp-subtext0">
          and {remaining} more contributor{remaining !== 1 ? "s" : ""}...
        </p>
      )}
    </div>
  );
}
