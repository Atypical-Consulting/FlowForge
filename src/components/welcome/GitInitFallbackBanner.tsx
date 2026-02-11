import { motion } from "framer-motion";
import { FolderGit2, GitBranch, Info, Loader2 } from "lucide-react";
import { useState } from "react";
import { commands } from "../../bindings";
import { fadeInUp } from "../../lib/animations";
import { Button } from "../ui/button";

interface GitInitFallbackBannerProps {
  path: string;
  onDismiss: () => void;
  onComplete: (path: string) => void;
}

export function GitInitFallbackBanner({
  path,
  onDismiss,
  onComplete,
}: GitInitFallbackBannerProps) {
  const folderName =
    path.split("/").pop() || path.split("\\").pop() || path;

  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInit = async () => {
    setIsInitializing(true);
    setError(null);
    try {
      const result = await commands.gitInit(path, "main");
      if (result.status === "error") {
        setError(String(result.error));
        return;
      }
      onComplete(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initialize repository");
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="show"
      role="region"
      aria-label="Git repository initialization"
      className="flex flex-col gap-3 p-4 bg-ctp-surface0/50 backdrop-blur-sm border border-ctp-surface1 rounded-lg"
    >
      <div className="flex items-start gap-3">
        <GitBranch className="w-5 h-5 text-ctp-blue shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-medium text-ctp-text">
            This folder is not a Git repository
          </div>
          <div className="text-sm text-ctp-subtext0 mt-1">
            Initialize &ldquo;{folderName}&rdquo; as a Git repository.
          </div>
        </div>
      </div>

      {error && (
        <div className="ml-8 text-sm text-ctp-red">{error}</div>
      )}

      <div className="ml-8 flex gap-2">
        <Button
          size="sm"
          onClick={handleInit}
          disabled={isInitializing}
          aria-busy={isInitializing}
          className="gap-2"
        >
          {isInitializing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Initializing...
            </>
          ) : (
            <>
              <FolderGit2 className="w-4 h-4" />
              Run git init
            </>
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss} disabled={isInitializing}>
          Dismiss
        </Button>
      </div>

      <div className="ml-8 flex items-center gap-1.5 text-ctp-overlay0 text-xs">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>
          Enable the Init Repo extension in Settings &gt; Extensions for
          .gitignore templates, README setup, and more.
        </span>
      </div>
    </motion.div>
  );
}
