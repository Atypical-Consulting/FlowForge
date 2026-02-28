import type { LucideIcon } from "lucide-react";
import { ArrowRight, GitBranch, GitMerge, Rocket, Tag } from "lucide-react";
import type { GitflowBranchType } from "../../../core/lib/branchClassifier";
import { BRANCH_TYPE_COLORS } from "../../../core/lib/branchClassifier";

interface ActionCard {
  icon: LucideIcon;
  title: string;
  description: string;
  command?: string;
}

const ACTION_MAP: Record<GitflowBranchType, ActionCard[]> = {
  feature: [
    {
      icon: GitMerge,
      title: "Finish feature",
      description: "Merge your feature branch back into develop",
      command: "git flow feature finish",
    },
    {
      icon: Rocket,
      title: "Push to remote",
      description: "Share your feature branch with the team",
      command: "git push -u origin feature/<name>",
    },
  ],
  develop: [
    {
      icon: GitBranch,
      title: "Start a feature",
      description: "Create a new feature branch from develop",
      command: "git flow feature start <name>",
    },
    {
      icon: Tag,
      title: "Start a release",
      description: "Begin preparing a new release from develop",
      command: "git flow release start <version>",
    },
  ],
  release: [
    {
      icon: GitMerge,
      title: "Finish release",
      description: "Merge into main and develop, create a version tag",
      command: "git flow release finish <version>",
    },
  ],
  hotfix: [
    {
      icon: GitMerge,
      title: "Finish hotfix",
      description: "Merge the fix into main and develop, create a patch tag",
      command: "git flow hotfix finish <name>",
    },
  ],
  main: [
    {
      icon: GitBranch,
      title: "Start a hotfix",
      description: "Create a hotfix branch if a production issue is found",
      command: "git flow hotfix start <name>",
    },
    {
      icon: Tag,
      title: "Review tags",
      description: "Check release tags and version history",
      command: "git tag -l",
    },
  ],
  other: [
    {
      icon: ArrowRight,
      title: "Switch to a gitflow branch",
      description:
        "This branch does not follow gitflow conventions. Consider switching to develop or creating a feature branch.",
    },
  ],
};

interface GitflowActionCardsProps {
  branchType: GitflowBranchType;
}

export function GitflowActionCards({ branchType }: GitflowActionCardsProps) {
  const cards = ACTION_MAP[branchType];
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ctp-subtext1">
        Suggested next actions
      </h3>
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-ctp-surface0/50 hover:bg-ctp-surface0 border border-ctp-surface1 rounded-lg p-4 transition-colors"
        >
          <div className="flex items-start gap-3">
            <card.icon
              className="w-5 h-5 shrink-0 mt-0.5"
              style={{ color: BRANCH_TYPE_COLORS[branchType] }}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ctp-text">{card.title}</p>
              <p className="text-sm text-ctp-subtext0 mt-0.5">
                {card.description}
              </p>
              {card.command && (
                <code className="inline-block mt-2 text-xs bg-ctp-crust text-ctp-peach px-2 py-1 rounded font-mono">
                  {card.command}
                </code>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
