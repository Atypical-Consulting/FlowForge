import { Folder, FolderOpen, Pin, Terminal, X } from "lucide-react";
import type { RecentRepo } from "../../../core/hooks/useRecentRepos";
import { Button } from "../../../core/components/ui/button";
import { HealthDot } from "./HealthDot";
import type { RepoHealthStatus } from "../hooks/useRepoHealth";

interface RepoCardProps {
  repo: RecentRepo;
  health?: RepoHealthStatus;
  onOpen: (repo: RecentRepo) => void;
  onRemove: (path: string) => void;
  onTogglePin: (path: string) => void;
  onOpenInTerminal?: (path: string) => void;
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function truncatePath(path: string, maxLength = 50): string {
  if (path.length <= maxLength) return path;
  const parts = path.split(/[/\\]/);
  if (parts.length <= 3) return path;
  return `${parts[0]}/.../${parts.slice(-2).join("/")}`;
}

export function RepoCard({
  repo,
  health,
  onOpen,
  onRemove,
  onTogglePin,
  onOpenInTerminal,
}: RepoCardProps) {
  return (
    <div
      className={`group flex items-center gap-3 p-3 rounded-lg hover:bg-ctp-surface0/50 cursor-pointer transition-colors min-h-[52px] ${
        repo.isPinned ? "border-l-2 border-ctp-peach" : ""
      }`}
      onClick={() => onOpen(repo)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(repo)}
      role="button"
      tabIndex={0}
    >
      <Folder className="w-5 h-5 text-ctp-blue shrink-0" />
      {health && <HealthDot status={health} />}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ctp-text truncate">
          {repo.name}
        </div>
        <div className="text-xs text-ctp-overlay0 truncate">
          {truncatePath(repo.path)}
        </div>
      </div>
      <div className="text-xs text-ctp-overlay0 shrink-0">
        {formatTime(repo.lastOpened)}
      </div>
      {/* Pin button */}
      <Button
        variant="ghost"
        size="icon"
        className={`h-7 w-7 transition-opacity ${
          repo.isPinned
            ? "opacity-100 text-ctp-peach"
            : "opacity-0 group-hover:opacity-100"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin(repo.path);
        }}
        aria-label={repo.isPinned ? "Unpin repository" : "Pin repository"}
      >
        <Pin
          className={`w-4 h-4 ${repo.isPinned ? "rotate-45" : ""}`}
        />
      </Button>
      {/* Open button */}
      <Button
        variant="ghost"
        size="icon"
        className="opacity-0 group-hover:opacity-100 h-7 w-7 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(repo);
        }}
        aria-label="Open repository"
      >
        <FolderOpen className="w-4 h-4 text-ctp-overlay0 hover:text-ctp-blue" />
      </Button>
      {/* Open in terminal button */}
      {onOpenInTerminal && (
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 h-7 w-7 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onOpenInTerminal(repo.path);
          }}
          aria-label="Open in terminal"
        >
          <Terminal className="w-4 h-4 text-ctp-overlay0 hover:text-ctp-teal" />
        </Button>
      )}
      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon"
        className="opacity-0 group-hover:opacity-100 h-7 w-7 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(repo.path);
        }}
        aria-label={`Remove ${repo.name} from recent`}
      >
        <X className="w-4 h-4 text-ctp-overlay0 hover:text-ctp-red" />
      </Button>
    </div>
  );
}
