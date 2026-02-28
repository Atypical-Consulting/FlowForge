import { cn } from "@/framework/lib/utils";
import {
  BRANCH_BADGE_STYLES,
  classifyBranch,
  type GitflowBranchType,
} from "../../../core/lib/branchClassifier";

const TEXT_COLORS: Record<GitflowBranchType, string> = {
  main: "text-ctp-blue",
  develop: "text-ctp-green",
  feature: "text-ctp-mauve",
  release: "text-ctp-peach",
  hotfix: "text-ctp-red",
  other: "",
};

interface BranchTypeBadgeProps {
  branchType?: GitflowBranchType;
  branchName?: string;
}

export function BranchTypeBadge({
  branchType,
  branchName,
}: BranchTypeBadgeProps) {
  const type =
    branchType ?? (branchName ? classifyBranch(branchName) : "other");
  if (type === "other") return null;

  return (
    <span
      className={cn(
        "text-xs px-1.5 py-0.5 rounded border font-medium shrink-0",
        BRANCH_BADGE_STYLES[type],
        TEXT_COLORS[type],
      )}
      aria-label={`${type} branch`}
    >
      {type}
    </span>
  );
}
