import { motion } from "framer-motion";
import { AlertCircle, GitBranch, Loader2 } from "lucide-react";
import { useState } from "react";
import { commands } from "../../bindings";
import { useRecentRepos } from "../../hooks/useRecentRepos";
import { fadeInUp } from "../../lib/animations";
import { useRepositoryStore } from "../../stores/repository";
import { Button } from "../ui/button";

interface GitInitBannerProps {
  path: string;
  onDismiss: () => void;
}

export function GitInitBanner({ path, onDismiss }: GitInitBannerProps) {
  const { openRepository } = useRepositoryStore();
  const { addRecentRepo } = useRecentRepos();
  const [useMainBranch, setUseMainBranch] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const folderName =
    path.split("/").pop() || path.split("\\").pop() || path;

  const handleInitialize = async () => {
    setIsInitializing(true);
    setInitError(null);
    try {
      const result = await commands.gitInit(
        path,
        useMainBranch ? "main" : null,
      );
      if (result.status === "error") {
        setInitError(result.error.message);
        return;
      }
      await openRepository(path);
      await addRecentRepo(path);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to initialize repository";
      setInitError(message);
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
            Would you like to initialize &ldquo;{folderName}&rdquo;?
          </div>
        </div>
      </div>

      <label className="ml-8 flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={useMainBranch}
          onChange={(e) => setUseMainBranch(e.target.checked)}
          className="rounded border-ctp-surface2 bg-ctp-surface0 text-ctp-blue focus:ring-ctp-blue/50"
        />
        <span className="text-sm text-ctp-subtext1">
          Set default branch to main
        </span>
      </label>

      <div className="ml-8 flex gap-2">
        <Button
          size="sm"
          onClick={handleInitialize}
          disabled={isInitializing}
          loading={isInitializing}
          loadingText="Initializing…"
          className="gap-2"
        >
          Initialize Repository
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          disabled={isInitializing}
        >
          Cancel
        </Button>
      </div>

      {initError && (
        <div className="flex items-center gap-2 ml-8 text-sm text-ctp-red">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {initError}
        </div>
      )}
    </motion.div>
  );
}
