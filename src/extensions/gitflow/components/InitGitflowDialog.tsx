import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import type { GitflowConfig } from "../../../bindings";
import { cn } from "../../../core/lib/utils";
import { useGitOpsStore as useBranchStore } from "../../../core/stores/domain/git-ops";
import { useGitOpsStore as useGitflowStore } from "../../../core/stores/domain/git-ops";
import { useGitOpsStore as useRepositoryStore } from "../../../core/stores/domain/git-ops";
import { toast } from "../../../core/stores/toast";

interface InitGitflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InitGitflowDialog({
  open,
  onOpenChange,
}: InitGitflowDialogProps) {
  const { gitflowStatus: status, initGitflow, gitflowIsLoading: isLoading, gitflowError: error, clearGitflowError: clearError } =
    useGitflowStore();
  const { loadBranches } = useBranchStore();
  const { refreshRepoStatus: refreshStatus } = useRepositoryStore();

  // Detect default main branch name
  const defaultMainBranch = status?.context.hasMain ? "main" : "master";

  const [config, setConfig] = useState<GitflowConfig>({
    mainBranch: defaultMainBranch,
    developBranch: "develop",
    featurePrefix: "feature/",
    releasePrefix: "release/",
    hotfixPrefix: "hotfix/",
  });
  const [pushDevelop, setPushDevelop] = useState(true);

  if (!open) return null;

  const handleClose = () => {
    clearError();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate prefixes end with /
    if (
      !config.featurePrefix.endsWith("/") ||
      !config.releasePrefix.endsWith("/") ||
      !config.hotfixPrefix.endsWith("/")
    ) {
      toast.error("Prefixes must end with /");
      return;
    }

    const success = await initGitflow(config, pushDevelop);
    if (success) {
      await loadBranches();
      await refreshStatus(); // Update branch name in header
      toast.success("Gitflow initialized! Switched to develop branch.");
      handleClose();
    }
  };

  const updateConfig = (field: keyof GitflowConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  // Check if develop already exists with a different name
  const developExists = status?.context.hasDevelop;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-5 w-[420px] shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Initialize Gitflow</h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 hover:bg-ctp-surface0 rounded text-ctp-overlay1 hover:text-ctp-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-ctp-overlay1 mb-4">
          Configure branch naming conventions for this repository.
        </p>

        {developExists && (
          <div className="flex items-start gap-2 p-3 mb-4 bg-ctp-yellow/10 border border-ctp-yellow/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-ctp-yellow shrink-0 mt-0.5" />
            <p className="text-sm text-ctp-yellow">
              A 'develop' branch already exists. It will be used as the develop
              branch.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Branch Names */}
          <div className="space-y-3">
            <h4 className="text-xs text-ctp-overlay0 uppercase tracking-wider">
              Branch Names
            </h4>

            <div>
              <label
                htmlFor="main-branch"
                className="block text-sm text-ctp-overlay1 mb-1.5"
              >
                Main branch
              </label>
              <input
                id="main-branch"
                type="text"
                value={config.mainBranch}
                onChange={(e) => updateConfig("mainBranch", e.target.value)}
                placeholder="main"
                className={cn(
                  "w-full px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded text-sm",
                  "focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue",
                )}
              />
            </div>

            <div>
              <label
                htmlFor="develop-branch"
                className="block text-sm text-ctp-overlay1 mb-1.5"
              >
                Develop branch
              </label>
              <input
                id="develop-branch"
                type="text"
                value={config.developBranch}
                onChange={(e) => updateConfig("developBranch", e.target.value)}
                placeholder="develop"
                className={cn(
                  "w-full px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded text-sm",
                  "focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue",
                )}
              />
            </div>
          </div>

          {/* Prefixes */}
          <div className="space-y-3">
            <h4 className="text-xs text-ctp-overlay0 uppercase tracking-wider">
              Branch Prefixes
            </h4>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="feature-prefix"
                  className="block text-sm text-ctp-overlay1 mb-1.5"
                >
                  Feature
                </label>
                <input
                  id="feature-prefix"
                  type="text"
                  value={config.featurePrefix}
                  onChange={(e) =>
                    updateConfig("featurePrefix", e.target.value)
                  }
                  placeholder="feature/"
                  className={cn(
                    "w-full px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded text-sm",
                    "focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue",
                    !config.featurePrefix.endsWith("/") && "border-ctp-red",
                  )}
                />
              </div>

              <div>
                <label
                  htmlFor="release-prefix"
                  className="block text-sm text-ctp-overlay1 mb-1.5"
                >
                  Release
                </label>
                <input
                  id="release-prefix"
                  type="text"
                  value={config.releasePrefix}
                  onChange={(e) =>
                    updateConfig("releasePrefix", e.target.value)
                  }
                  placeholder="release/"
                  className={cn(
                    "w-full px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded text-sm",
                    "focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue",
                    !config.releasePrefix.endsWith("/") && "border-ctp-red",
                  )}
                />
              </div>

              <div>
                <label
                  htmlFor="hotfix-prefix"
                  className="block text-sm text-ctp-overlay1 mb-1.5"
                >
                  Hotfix
                </label>
                <input
                  id="hotfix-prefix"
                  type="text"
                  value={config.hotfixPrefix}
                  onChange={(e) => updateConfig("hotfixPrefix", e.target.value)}
                  placeholder="hotfix/"
                  className={cn(
                    "w-full px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded text-sm",
                    "focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue",
                    !config.hotfixPrefix.endsWith("/") && "border-ctp-red",
                  )}
                />
              </div>
            </div>
          </div>

          {/* Push option */}
          <label className="flex items-center gap-2 text-sm text-ctp-overlay1 cursor-pointer">
            <input
              type="checkbox"
              checked={pushDevelop}
              onChange={(e) => setPushDevelop(e.target.checked)}
              className="rounded border-ctp-surface2 bg-ctp-surface0 text-ctp-blue focus:ring-ctp-blue"
            />
            Push develop branch to remote
          </label>

          {error && <p className="text-ctp-red text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-ctp-overlay1 hover:text-ctp-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                !config.mainBranch.trim() ||
                !config.developBranch.trim() ||
                isLoading
              }
              className="px-4 py-2 text-sm bg-ctp-blue hover:bg-ctp-blue/80 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Initializing..." : "Initialize Gitflow"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
