import { Channel } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useMutation } from "@tanstack/react-query";
import { FolderOpen, GitFork, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type CloneProgress as CloneProgressType,
  commands,
} from "../../../bindings";
import { cn } from "../../../core/lib/utils";
import { useRecentRepos } from "../../../core/hooks/useRecentRepos";
import { useGitOpsStore as useCloneStore } from "../../../core/stores/domain/git-ops";
import { useGitOpsStore as useRepositoryStore } from "../../../core/stores/domain/git-ops";
import { toast } from "@/framework/stores/toast";
import { Button } from "../../../core/components/ui/button";
import { CloneProgress } from "./CloneProgress";

/** Extract repository name from a Git URL */
function extractRepoName(url: string): string | null {
  if (!url.trim()) return null;

  // Handle various URL formats:
  // https://github.com/user/repo.git
  // git@github.com:user/repo.git
  // https://github.com/user/repo
  const match = url.match(/[/:]([^/:]+?)(?:\.git)?$/);
  return match ? match[1] : null;
}

/** Check if running on Windows */
function isWindows(): boolean {
  return navigator.platform.toLowerCase().includes("win");
}

/** Get default clone destination path based on platform and repo name */
function getDefaultDestination(repoName: string): string {
  if (isWindows()) {
    return `C:\\repo\\${repoName}`;
  }
  // macOS and Linux use ~/repo
  return `~/repo/${repoName}`;
}

interface CloneFormProps {
  onCancel?: () => void;
}

export function CloneForm({ onCancel }: CloneFormProps) {
  const [url, setUrl] = useState("");
  const [destination, setDestination] = useState("");
  const [userOverrodeDestination, setUserOverrodeDestination] = useState(false);
  const {
    cloneIsCloning: isCloning,
    cloneProgress: progress,
    startClone,
    updateCloneProgress: updateProgress,
    finishClone,
    setCloneError: setError,
    resetClone: reset,
  } = useCloneStore();
  const { openRepository } = useRepositoryStore();
  const { addRecentRepo } = useRecentRepos();

  // Auto-set destination based on URL (unless user manually chose a folder)
  useEffect(() => {
    if (userOverrodeDestination) return;

    const repoName = extractRepoName(url);
    if (repoName) {
      setDestination(getDefaultDestination(repoName));
    } else {
      setDestination("");
    }
  }, [url, userOverrodeDestination]);

  const cloneMutation = useMutation({
    mutationFn: async () => {
      startClone();

      const channel = new Channel<CloneProgressType>();
      channel.onmessage = (event) => {
        updateProgress(event);
      };

      const result = await commands.cloneRepository(url, destination, channel);
      if (result.status === "error") {
        throw new Error(
          typeof result.error === "object" && "message" in result.error
            ? String(result.error.message)
            : "Clone failed",
        );
      }
      return result.data;
    },
    onSuccess: async (clonedPath) => {
      finishClone();
      toast.success(`Cloned to ${clonedPath}`);

      // Auto-open the cloned repository
      try {
        await openRepository(clonedPath);
        await addRecentRepo(clonedPath);
      } catch (e) {
        console.error("Failed to open cloned repository:", e);
      }
    },
    onError: (error) => {
      setError(String(error));
      toast.error(`Clone failed: ${String(error)}`);
    },
  });

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Clone Destination",
      });

      if (selected && typeof selected === "string") {
        setDestination(selected);
        setUserOverrodeDestination(true);
      }
    } catch (e) {
      console.error("Failed to open folder picker:", e);
    }
  };

  const handleClone = () => {
    cloneMutation.mutate();
  };

  const handleCancel = () => {
    reset();
    onCancel?.();
  };

  const isValidUrl =
    url.trim().length > 0 &&
    (url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("git@"));
  const canClone = isValidUrl && destination.trim().length > 0 && !isCloning;

  // Show progress view only while actively cloning (not after finished)
  if (isCloning) {
    return (
      <div className="space-y-4">
        <CloneProgress progress={progress} isCloning={isCloning} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-ctp-text flex items-center gap-2">
          <GitFork className="w-4 h-4" />
          Clone Repository
        </h3>
        {onCancel && (
          <button
            type="button"
            onClick={handleCancel}
            className="p-1 hover:bg-ctp-surface0 rounded"
          >
            <X className="w-4 h-4 text-ctp-overlay1" />
          </button>
        )}
      </div>

      {/* URL Input */}
      <div className="space-y-1.5">
        <label htmlFor="clone-url" className="text-xs text-ctp-overlay1">
          Repository URL
        </label>
        <input
          id="clone-url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/user/repo.git"
          className={cn(
            "w-full px-3 py-2 text-sm bg-ctp-mantle border border-ctp-surface1",
            "rounded focus:outline-none focus:border-ctp-blue",
            "text-ctp-text placeholder:text-ctp-overlay0",
          )}
        />
      </div>

      {/* Destination */}
      <div className="space-y-1.5">
        <label htmlFor="clone-dest" className="text-xs text-ctp-overlay1">
          Destination Folder
        </label>
        <div className="flex gap-2">
          <input
            id="clone-dest"
            type="text"
            value={destination}
            readOnly
            placeholder="Select folder..."
            className={cn(
              "flex-1 px-3 py-2 text-sm bg-ctp-mantle border border-ctp-surface1",
              "rounded focus:outline-none text-ctp-text placeholder:text-ctp-overlay0",
            )}
          />
          <Button variant="outline" onClick={handleBrowse}>
            <FolderOpen className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Clone Button */}
      <Button onClick={handleClone} disabled={!canClone} className="w-full">
        {cloneMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Cloning...
          </>
        ) : (
          <>
            <GitFork className="w-4 h-4 mr-2" />
            Clone
          </>
        )}
      </Button>

      {!isValidUrl && url.length > 0 && (
        <p className="text-xs text-ctp-yellow">
          URL should start with https://, http://, or git@
        </p>
      )}
    </div>
  );
}
