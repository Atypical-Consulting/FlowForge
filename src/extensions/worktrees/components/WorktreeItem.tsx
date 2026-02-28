import {
  ArrowRightLeft,
  ExternalLink,
  FolderGit2,
  Home,
  Trash2,
} from "lucide-react";
import { cn } from "@/framework/lib/utils";
import type { WorktreeInfo } from "../../../bindings";

interface WorktreeItemProps {
  worktree: WorktreeInfo;
  isSelected: boolean;
  onSelect: () => void;
  onOpenInExplorer: () => void;
  onSwitchTo: () => void;
  onDelete: () => void;
}

const statusColors = {
  clean: "text-ctp-green",
  dirty: "text-ctp-yellow",
  conflicts: "text-ctp-red",
  invalid: "text-ctp-overlay0",
};

const statusLabels = {
  clean: "Clean",
  dirty: "Uncommitted changes",
  conflicts: "Has conflicts",
  invalid: "Invalid worktree",
};

export function WorktreeItem({
  worktree,
  isSelected,
  onSelect,
  onOpenInExplorer,
  onSwitchTo,
  onDelete,
}: WorktreeItemProps) {
  return (
    <div
      className={cn(
        "group px-3 py-2 cursor-pointer transition-colors",
        "hover:bg-ctp-surface0/50",
        isSelected && "bg-ctp-surface0",
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onSelect();
        }
      }}
    >
      <div className="flex items-center gap-2">
        {/* Icon */}
        <div className={cn("shrink-0", statusColors[worktree.status])}>
          {worktree.isMain ? (
            <Home className="w-4 h-4" />
          ) : (
            <FolderGit2 className="w-4 h-4" />
          )}
        </div>

        {/* Name and branch */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm truncate">
              {worktree.name}
            </span>
            {worktree.isMain && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-ctp-surface1 text-ctp-subtext0">
                main
              </span>
            )}
          </div>
          {worktree.branch && (
            <div className="text-xs text-ctp-subtext0 truncate">
              {worktree.branch}
            </div>
          )}
        </div>

        {/* Status indicator */}
        <div
          className={cn("w-2 h-2 rounded-full shrink-0", {
            "bg-ctp-green": worktree.status === "clean",
            "bg-ctp-yellow": worktree.status === "dirty",
            "bg-ctp-red": worktree.status === "conflicts",
            "bg-ctp-overlay0": worktree.status === "invalid",
          })}
          title={statusLabels[worktree.status]}
        />

        {/* Action buttons (show on hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!worktree.isMain && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSwitchTo();
              }}
              className="p-1 hover:bg-ctp-surface1 rounded text-ctp-subtext0 hover:text-ctp-text"
              title="Switch to this worktree"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenInExplorer();
            }}
            className="p-1 hover:bg-ctp-surface1 rounded text-ctp-subtext0 hover:text-ctp-text"
            title="Open in file explorer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          {!worktree.isMain && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 hover:bg-ctp-red/20 rounded text-ctp-subtext0 hover:text-ctp-red"
              title="Delete worktree"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
