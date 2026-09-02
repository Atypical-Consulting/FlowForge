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

const DOT_COLORS: Record<GitflowBranchType, string> = {
  main: "bg-ctp-blue",
  develop: "bg-ctp-green",
  feature: "bg-ctp-mauve",
  release: "bg-ctp-peach",
  hotfix: "bg-ctp-red",
  other: "",
};

interface BranchTypeBadgeProps {
  branchType?: GitflowBranchType;
  branchName?: string;
  /**
   * `pill` (default) renders the type as text; `dot` renders a small colored
   * dot with the type in its tooltip — for dense rows where the branch name
   * must keep priority and the prefix (feature/, release/…) already says it.
   */
  variant?: "pill" | "dot";
}

export function BranchTypeBadge({
  branchType,
  branchName,
  variant = "pill",
}: BranchTypeBadgeProps) {
  const type =
    branchType ?? (branchName ? classifyBranch(branchName) : "other");
  if (type === "other") return null;

  if (variant === "dot") {
    return (
      <span
        role="img"
        className={cn("w-2 h-2 rounded-full shrink-0", DOT_COLORS[type])}
        title={`${type} branch`}
        aria-label={`${type} branch`}
        data-testid="branch-type-dot"
      />
    );
  }

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
