import type { BranchInfo } from "../../bindings";

/**
 * Branch type classification for Gitflow workflows.
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
 * Handles ref-prefixed names (refs/heads/, origin/) and recognizes
 * slash and dash prefix variants (feature/, feature-).
 *
 * @param branchName - The branch name (e.g., "refs/heads/feature/login", "main")
 * @returns The Gitflow branch type classification
 */
export function classifyBranch(branchName: string): GitflowBranchType {
  const bare = branchName
    .replace(/^refs\/heads\//, "")
    .replace(/^origin\//, "");

  if (bare === "main" || bare === "master") return "main";
  if (bare === "develop" || bare === "development" || bare === "dev")
    return "develop";
  if (bare.startsWith("feature/") || bare.startsWith("feature-"))
    return "feature";
  if (bare.startsWith("release/") || bare.startsWith("release-"))
    return "release";
  if (bare.startsWith("hotfix/") || bare.startsWith("hotfix-"))
    return "hotfix";
  return "other";
}

// ── CSS variable colors ──

/**
 * Catppuccin accent color (CSS custom property) for each Gitflow branch type.
 * Used for SVG lane highlighting and badge colors.
 */
export const BRANCH_TYPE_COLORS: Record<GitflowBranchType, string> = {
  main: "var(--catppuccin-color-blue)",
  develop: "var(--catppuccin-color-green)",
  feature: "var(--catppuccin-color-mauve)",
  release: "var(--catppuccin-color-peach)",
  hotfix: "var(--catppuccin-color-red)",
  other: "var(--catppuccin-color-overlay1)",
};

// ── Tailwind tokens ──

/**
 * Tailwind color class (without prefix) for each Gitflow branch type.
 */
export const BRANCH_TYPE_TW: Record<GitflowBranchType, string> = {
  main: "ctp-blue",
  develop: "ctp-green",
  feature: "ctp-mauve",
  release: "ctp-peach",
  hotfix: "ctp-red",
  other: "ctp-overlay1",
};

// ── Hex colors (for SVG rendering) ──

/** Catppuccin Mocha hex colors for SVG rendering */
export const BRANCH_HEX_COLORS: Record<GitflowBranchType, string> = {
  main: "#89b4fa",
  develop: "#a6e3a1",
  feature: "#cba6f7",
  release: "#fab387",
  hotfix: "#f38ba8",
  other: "#6c7086",
};

// ── Badge styles ──

/** Tailwind-compatible CSS badge classes per branch type */
export const BRANCH_BADGE_STYLES: Record<GitflowBranchType, string> = {
  main: "border-ctp-blue bg-ctp-blue/10 hover:bg-ctp-blue/20",
  develop: "border-ctp-green bg-ctp-green/10 hover:bg-ctp-green/20",
  feature: "border-ctp-mauve bg-ctp-mauve/10 hover:bg-ctp-mauve/20",
  release: "border-ctp-peach bg-ctp-peach/10 hover:bg-ctp-peach/20",
  hotfix: "border-ctp-red bg-ctp-red/10 hover:bg-ctp-red/20",
  other: "border-ctp-overlay0 bg-ctp-surface0/50 hover:bg-ctp-surface1/50",
};

// ── Ring colors ──

/** Tailwind ring color classes per branch type */
export const BRANCH_RING_COLORS: Record<GitflowBranchType, string> = {
  main: "ring-ctp-blue",
  develop: "ring-ctp-green",
  feature: "ring-ctp-mauve",
  release: "ring-ctp-peach",
  hotfix: "ring-ctp-red",
  other: "ring-ctp-overlay0",
};

// ── Enriched branch type ──

export interface EnrichedBranch extends BranchInfo {
  branchType: GitflowBranchType;
  isPinned: boolean;
  lastVisited: number | null;
}
