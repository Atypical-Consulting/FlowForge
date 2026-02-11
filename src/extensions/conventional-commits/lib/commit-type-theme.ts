import type { ElementType } from "react";
import {
  Bug,
  FileText,
  Hammer,
  Package,
  Paintbrush,
  Rocket,
  Settings,
  Sparkles,
  TestTube,
  Undo,
  Zap,
} from "lucide-react";

/**
 * All recognized conventional commit types.
 *
 * This union is the single source of truth — every icon, color, and label
 * lookup is keyed on this type.
 */
export type ConventionalCommitType =
  | "feat"
  | "fix"
  | "docs"
  | "style"
  | "refactor"
  | "perf"
  | "test"
  | "chore"
  | "ci"
  | "build"
  | "revert";

/**
 * Complete theme configuration for a single commit type.
 *
 * Extensible: add new fields here and every consumer gets them automatically.
 */
export interface CommitTypeTheme {
  icon: ElementType;
  color: string;
  badgeClasses: string;
  emoji: string;
  label: string;
}

/**
 * Single source of truth for commit type visual configuration.
 *
 * To add a new commit type:
 * 1. Add it to `ConventionalCommitType` union above
 * 2. Add its entry here
 * 3. Done — all consumers derive from this map
 */
export const COMMIT_TYPE_THEME: Record<ConventionalCommitType, CommitTypeTheme> =
  {
    feat: {
      icon: Sparkles,
      color: "text-ctp-green",
      badgeClasses: "text-ctp-green bg-ctp-green/10 border-ctp-green/30",
      emoji: "\u{2728}",
      label: "Feature",
    },
    fix: {
      icon: Bug,
      color: "text-ctp-red",
      badgeClasses: "text-ctp-red bg-ctp-red/10 border-ctp-red/30",
      emoji: "\u{1F41B}",
      label: "Bug Fix",
    },
    docs: {
      icon: FileText,
      color: "text-ctp-blue",
      badgeClasses: "text-ctp-blue bg-ctp-blue/10 border-ctp-blue/30",
      emoji: "\u{1F4DD}",
      label: "Documentation",
    },
    style: {
      icon: Paintbrush,
      color: "text-ctp-pink",
      badgeClasses: "text-ctp-pink bg-ctp-pink/10 border-ctp-pink/30",
      emoji: "\u{1F3A8}",
      label: "Style",
    },
    refactor: {
      icon: Hammer,
      color: "text-ctp-peach",
      badgeClasses: "text-ctp-peach bg-ctp-peach/10 border-ctp-peach/30",
      emoji: "\u{1F528}",
      label: "Refactor",
    },
    perf: {
      icon: Zap,
      color: "text-ctp-yellow",
      badgeClasses: "text-ctp-yellow bg-ctp-yellow/10 border-ctp-yellow/30",
      emoji: "\u{26A1}",
      label: "Performance",
    },
    test: {
      icon: TestTube,
      color: "text-ctp-teal",
      badgeClasses: "text-ctp-teal bg-ctp-teal/10 border-ctp-teal/30",
      emoji: "\u{1F9EA}",
      label: "Test",
    },
    chore: {
      icon: Settings,
      color: "text-ctp-lavender",
      badgeClasses:
        "text-ctp-lavender bg-ctp-lavender/10 border-ctp-lavender/30",
      emoji: "\u{2699}\u{FE0F}",
      label: "Chore",
    },
    ci: {
      icon: Rocket,
      color: "text-ctp-sky",
      badgeClasses: "text-ctp-sky bg-ctp-sky/10 border-ctp-sky/30",
      emoji: "\u{1F680}",
      label: "CI",
    },
    build: {
      icon: Package,
      color: "text-ctp-maroon",
      badgeClasses: "text-ctp-maroon bg-ctp-maroon/10 border-ctp-maroon/30",
      emoji: "\u{1F4E6}",
      label: "Build",
    },
    revert: {
      icon: Undo,
      color: "text-ctp-mauve",
      badgeClasses: "text-ctp-mauve bg-ctp-mauve/10 border-ctp-mauve/30",
      emoji: "\u{21A9}\u{FE0F}",
      label: "Revert",
    },
  };

/** Lookup helpers — derived from the theme map for convenience. */

export function getCommitTypeIcon(
  type: ConventionalCommitType,
): ElementType {
  return COMMIT_TYPE_THEME[type].icon;
}

export function getCommitTypeColor(type: ConventionalCommitType): string {
  return COMMIT_TYPE_THEME[type].color;
}

export function getCommitTypeBadgeClasses(
  type: ConventionalCommitType,
): string {
  return COMMIT_TYPE_THEME[type].badgeClasses;
}
