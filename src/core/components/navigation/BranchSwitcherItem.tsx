import { Check, GitBranch } from "lucide-react";
import type { BranchInfo } from "../../bindings";
import { cn } from "../../lib/utils";

interface BranchSwitcherItemProps {
  branch: BranchInfo;
  isCurrent: boolean;
  isHighlighted: boolean;
  onSelect: () => void;
}

export function BranchSwitcherItem({
  branch,
  isCurrent,
  isHighlighted,
  onSelect,
}: BranchSwitcherItemProps) {
  return (
    <div
      role="option"
      aria-selected={isHighlighted}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded transition-colors cursor-pointer",
        isHighlighted ? "bg-ctp-surface0" : "hover:bg-ctp-surface0/50",
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={-1}
    >
      <GitBranch className="w-4 h-4 text-ctp-subtext0 shrink-0" />
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <span className="text-sm text-ctp-text truncate">{branch.name}</span>
        {branch.isRemote && (
          <span className="text-xs text-ctp-overlay0 bg-ctp-surface1 px-1.5 py-0.5 rounded shrink-0">
            remote
          </span>
        )}
      </div>
      <span className="text-xs text-ctp-overlay0 font-mono shrink-0">
        {branch.lastCommitOid}
      </span>
      {isCurrent && (
        <Check
          className="w-4 h-4 text-ctp-green shrink-0"
          aria-label="Current branch"
        />
      )}
    </div>
  );
}
