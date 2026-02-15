import { Check, FolderGit, Pin } from "lucide-react";
import { cn } from "../../../core/lib/utils";

export interface RepoItemData {
  path: string;
  name: string;
}

interface RepoSwitcherItemProps {
  repo: RepoItemData;
  isPinned: boolean;
  isCurrent: boolean;
  isHighlighted: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}

function abbreviatePath(fullPath: string): string {
  const home = fullPath.startsWith("/Users/")
    ? fullPath.replace(/^\/Users\/[^/]+/, "~")
    : fullPath;
  const segments = home.split("/").filter(Boolean);
  if (segments.length <= 2) return home;
  return segments.slice(-2).join("/");
}

export function RepoSwitcherItem({
  repo,
  isPinned,
  isCurrent,
  isHighlighted,
  onSelect,
  onTogglePin,
}: RepoSwitcherItemProps) {
  return (
    <div
      role="option"
      aria-selected={isHighlighted}
      className={cn(
        "group/item w-full flex items-center gap-3 px-3 py-2 rounded transition-colors cursor-pointer",
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
      <FolderGit className="w-4 h-4 text-ctp-subtext0 shrink-0" />
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm font-medium text-ctp-text truncate">
          {repo.name}
        </div>
        <div className="text-xs text-ctp-overlay0 truncate">
          {abbreviatePath(repo.path)}
        </div>
      </div>
      {isCurrent && (
        <Check
          className="w-4 h-4 text-ctp-green shrink-0"
          aria-label="Current repository"
        />
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin();
        }}
        className={cn(
          "p-1 rounded transition-colors shrink-0",
          isPinned
            ? "text-ctp-blue hover:text-ctp-sapphire"
            : "text-ctp-overlay0 opacity-0 group-hover/item:opacity-100 hover:text-ctp-subtext0",
          isPinned && "opacity-100",
        )}
        title={isPinned ? "Unpin repository" : "Pin repository"}
        aria-label={isPinned ? "Unpin repository" : "Pin repository"}
      >
        <Pin className={cn("w-3.5 h-3.5", isPinned && "fill-current")} />
      </button>
    </div>
  );
}
