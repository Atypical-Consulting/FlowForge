import { GitCommit } from "lucide-react";
import { memo } from "react";
import {
  COMMIT_TYPE_THEME,
  type ConventionalCommitType,
} from "../../../extensions/conventional-commits/lib/commit-type-theme";
import { cn } from "../../lib/utils";
import { parseConventionalType } from "../../lib/commitClassifier";

interface CommitTypeIconProps {
  /** Pass a commit type directly. */
  commitType?: ConventionalCommitType;
  /** Or pass a commit message — the type will be parsed from it. */
  message?: string;
  className?: string;
  /** Whether to apply the type's Catppuccin color (default: true). */
  colored?: boolean;
}

/**
 * Renders the Lucide icon for a conventional commit type with optional color.
 *
 * Accepts either an explicit `commitType` or a `message` string to parse.
 * Falls back to a generic GitCommit icon when the type is unknown.
 */
export const CommitTypeIcon = memo(function CommitTypeIcon({
  commitType,
  message,
  className,
  colored = true,
}: CommitTypeIconProps) {
  const resolvedType =
    commitType ??
    ((message ? parseConventionalType(message) : null) as ConventionalCommitType | null);

  const theme = resolvedType ? COMMIT_TYPE_THEME[resolvedType] : null;
  const Icon = theme?.icon ?? GitCommit;
  const colorClass = colored && theme ? theme.color : "text-ctp-overlay0";

  return <Icon className={cn("w-4 h-4 shrink-0", colorClass, className)} />;
});
