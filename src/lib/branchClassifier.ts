/**
 * Branch type classification for Gitflow cheatsheet.
 */
export type GitflowBranchType =
  | "main"
  | "develop"
  | "feature"
  | "release"
  | "hotfix"
  | "other";

/**
 * Classify a branch name into its Gitflow type.
 *
 * @param branchName - The full branch name (e.g., "feature/add-login", "main")
 * @returns The Gitflow branch type classification
 */
export function classifyBranch(branchName: string): GitflowBranchType {
  if (branchName === "main" || branchName === "master") return "main";
  if (branchName === "develop" || branchName === "development") return "develop";
  if (branchName.startsWith("feature/")) return "feature";
  if (branchName.startsWith("release/")) return "release";
  if (branchName.startsWith("hotfix/")) return "hotfix";
  return "other";
}

/**
 * Catppuccin accent color for each Gitflow branch type.
 * Used for SVG lane highlighting and badge colors.
 */
export const BRANCH_TYPE_COLORS: Record<GitflowBranchType, string> = {
  main: "var(--ctp-red)",
  develop: "var(--ctp-blue)",
  feature: "var(--ctp-green)",
  release: "var(--ctp-peach)",
  hotfix: "var(--ctp-mauve)",
  other: "var(--ctp-overlay1)",
};

/**
 * Tailwind color class (without prefix) for each Gitflow branch type.
 */
export const BRANCH_TYPE_TW: Record<GitflowBranchType, string> = {
  main: "ctp-red",
  develop: "ctp-blue",
  feature: "ctp-green",
  release: "ctp-peach",
  hotfix: "ctp-mauve",
  other: "ctp-overlay1",
};
