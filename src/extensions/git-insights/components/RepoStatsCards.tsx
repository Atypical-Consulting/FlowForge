import { motion } from "framer-motion";
import { GitCommitHorizontal, GitBranch, Users, Clock } from "lucide-react";
import type { RepoInsights } from "../types";

interface Props {
  insights: RepoInsights | null;
  branchCount: number;
  isLoading: boolean;
}

interface StatCardData {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  gradientClass: string;
}

function computeRepoAge(firstCommitMs: number): string {
  const days = Math.floor((Date.now() - firstCommitMs) / 86_400_000);
  if (days < 1) return "<1d";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  const years = Math.floor(days / 365);
  const remainMonths = Math.floor((days % 365) / 30);
  return remainMonths > 0 ? `${years}y ${remainMonths}mo` : `${years}y`;
}

export function RepoStatsCards({ insights, branchCount, isLoading }: Props) {
  const cards: StatCardData[] = [
    {
      label: "Total Commits",
      value: insights?.totalCommits.toLocaleString() ?? "\u2014",
      icon: GitCommitHorizontal,
      color: "text-ctp-blue",
      bgColor: "bg-ctp-blue/10",
      gradientClass:
        "bg-gradient-to-r from-transparent via-ctp-blue/30 to-transparent",
    },
    {
      label: "Active Branches",
      value: branchCount.toString(),
      icon: GitBranch,
      color: "text-ctp-green",
      bgColor: "bg-ctp-green/10",
      gradientClass:
        "bg-gradient-to-r from-transparent via-ctp-green/30 to-transparent",
    },
    {
      label: "Contributors",
      value: insights?.contributorCount.toString() ?? "\u2014",
      icon: Users,
      color: "text-ctp-mauve",
      bgColor: "bg-ctp-mauve/10",
      gradientClass:
        "bg-gradient-to-r from-transparent via-ctp-mauve/30 to-transparent",
    },
    {
      label: "Repo Age",
      value: insights?.firstCommitMs
        ? computeRepoAge(insights.firstCommitMs)
        : "\u2014",
      icon: Clock,
      color: "text-ctp-peach",
      bgColor: "bg-ctp-peach/10",
      gradientClass:
        "bg-gradient-to-r from-transparent via-ctp-peach/30 to-transparent",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.label}
          className="group relative overflow-hidden rounded-xl border border-ctp-surface0/50 bg-ctp-mantle/60 px-4 py-3.5 backdrop-blur-sm transition-colors hover:border-ctp-surface1/70"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.2 }}
        >
          {/* Subtle gradient accent at top */}
          <div
            className={`absolute inset-x-0 top-0 h-px ${card.gradientClass}`}
          />

          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-ctp-subtext0">
                {card.label}
              </p>
              <p className={`mt-1 text-xl font-bold ${card.color}`}>
                {isLoading ? "\u2014" : card.value}
              </p>
            </div>
            <div className={`rounded-lg p-2 ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
