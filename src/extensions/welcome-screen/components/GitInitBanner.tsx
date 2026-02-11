import { motion } from "framer-motion";
import { FolderGit2, GitBranch } from "lucide-react";
import { fadeInUp } from "../../../core/lib/animations";
import { Button } from "../../../core/components/ui/button";

interface GitInitBannerProps {
  path: string;
  onDismiss: () => void;
  onSetup: () => void;
}

export function GitInitBanner({ path, onDismiss, onSetup }: GitInitBannerProps) {
  const folderName =
    path.split("/").pop() || path.split("\\").pop() || path;

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
            Initialize &ldquo;{folderName}&rdquo; with .gitignore templates,
            README, and more.
          </div>
        </div>
      </div>

      <div className="ml-8 flex gap-2">
        <Button size="sm" onClick={onSetup} className="gap-2">
          <FolderGit2 className="w-4 h-4" />
          Set Up Repository
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </motion.div>
  );
}
