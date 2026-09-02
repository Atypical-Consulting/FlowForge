import {
  AlertTriangle,
  BookOpen,
  Flag,
  GitBranch,
  Play,
  RefreshCw,
  Square,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useBladeNavigation } from "../../../core/hooks/useBladeNavigation";
import {
  useGitOpsStore as useBranchStore,
  useGitOpsStore as useGitflowStore,
} from "../../../core/stores/domain/git-ops";
import { useGitflowWorkflow } from "../hooks/useGitflowWorkflow";
import { FinishFlowDialog } from "./FinishFlowDialog";
import { InitGitflowDialog } from "./InitGitflowDialog";
import { StartFlowDialog } from "./StartFlowDialog";

type FlowType = "feature" | "release" | "hotfix";

export function GitflowPanel() {
  const {
    gitflowStatus: status,
    gitflowIsLoading: isLoading,
    gitflowError: error,
    refreshGitflow: refresh,
    clearGitflowError: clearError,
  } = useGitflowStore();
  const {
    abortGitflow: abort,
    isBusy: machineIsBusy,
    isAborting,
    error: operationError,
    refreshErrors,
    isStale,
    dismiss,
    retryRefresh,
  } = useGitflowWorkflow();
  const { openBlade } = useBladeNavigation();
  const _branches = useBranchStore((s) => s.branchList);
  const [showStartDialog, setShowStartDialog] = useState<FlowType | null>(null);
  const [showFinishDialog, setShowFinishDialog] = useState<FlowType | null>(
    null,
  );
  const [showInitDialog, setShowInitDialog] = useState(false);

  // Refresh gitflow status when branches change (includes checkout, create, delete)
  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!status) {
    return (
      <div className="p-3 text-ctp-overlay1 text-sm">
        {isLoading
          ? "Loading gitflow status..."
          : "No gitflow status available"}
      </div>
    );
  }

  // Check if Gitflow is initialized (has config in .git/config)
  const isInitialized = status.context.isInitialized;

  if (!status.isGitflowReady || !isInitialized) {
    return (
      <div className="p-3">
        <div className="flex items-center gap-2 text-ctp-yellow text-sm mb-2">
          <AlertTriangle className="w-4 h-4" />
          <span>Gitflow not initialized</span>
        </div>
        <p className="text-ctp-overlay1 text-xs mb-3">
          {status.context.hasMain
            ? "Initialize Gitflow to enable workflow automation."
            : "Repository needs a main branch to initialize Gitflow."}
        </p>
        {status.context.hasMain && (
          <button
            type="button"
            onClick={() => setShowInitDialog(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-ctp-blue hover:bg-ctp-blue/80 rounded transition-colors"
          >
            <GitBranch className="w-4 h-4" />
            Initialize Gitflow
          </button>
        )}
        <InitGitflowDialog
          open={showInitDialog}
          onOpenChange={setShowInitDialog}
        />
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Active flow indicator */}
      {status.activeFlow && (
        <div className="bg-ctp-mauve/20 border border-ctp-mauve/50 rounded p-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-ctp-mauve text-xs uppercase tracking-wider">
                {status.activeFlow.flowType}
              </span>
              <p className="font-medium text-sm">{status.activeFlow.name}</p>
            </div>
            {status.canAbort && (
              <button
                type="button"
                onClick={() => abort()}
                disabled={machineIsBusy}
                className="p-1.5 hover:bg-ctp-red/20 rounded text-ctp-red hover:text-ctp-red disabled:opacity-40 disabled:cursor-not-allowed"
                title={isAborting ? "Aborting..." : "Abort current flow"}
                aria-label={isAborting ? "Aborting..." : "Abort current flow"}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Start/finish/abort failure (from the gitflow machine) */}
      {operationError && (
        <div
          role="alert"
          className="bg-ctp-red/20 border border-ctp-red/50 rounded p-2.5 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-ctp-red text-xs">{operationError}</span>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss error"
              className="text-ctp-red hover:text-ctp-red shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Operation succeeded but the post-operation refresh failed */}
      {isStale && (
        <div
          role="alert"
          className="bg-ctp-yellow/20 border border-ctp-yellow/50 rounded p-2.5 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-ctp-yellow text-xs">
              Operation completed but the view may be outdated:{" "}
              {refreshErrors.join("; ")}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={retryRefresh}
                aria-label="Retry refresh"
                className="text-ctp-yellow hover:text-ctp-yellow"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss refresh warning"
                className="text-ctp-yellow hover:text-ctp-yellow"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status refresh / init failure (from the store) */}
      {error && (
        <div
          role="alert"
          className="bg-ctp-red/20 border border-ctp-red/50 rounded p-2.5 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-ctp-red text-xs">{error}</span>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss error"
              className="text-ctp-red hover:text-ctp-red shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Start buttons */}
      <div className="space-y-1.5">
        <h4 className="text-xs text-ctp-overlay0 uppercase tracking-wider">
          Start
        </h4>

        <button
          type="button"
          onClick={() => setShowStartDialog("feature")}
          disabled={!status.canStartFeature || isLoading}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded hover:bg-ctp-surface0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={
            !status.canStartFeature
              ? "Switch to develop branch to start a feature"
              : "Start a new feature branch"
          }
        >
          <Play className="w-3.5 h-3.5 text-ctp-green" />
          <span>Feature</span>
        </button>

        <button
          type="button"
          onClick={() => setShowStartDialog("release")}
          disabled={!status.canStartRelease || isLoading}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded hover:bg-ctp-surface0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={
            !status.canStartRelease
              ? "Switch to develop branch (no active release)"
              : "Start a new release branch"
          }
        >
          <Flag className="w-3.5 h-3.5 text-ctp-blue" />
          <span>Release</span>
        </button>

        <button
          type="button"
          onClick={() => setShowStartDialog("hotfix")}
          disabled={!status.canStartHotfix || isLoading}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded hover:bg-ctp-surface0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={
            !status.canStartHotfix
              ? "Switch to main branch to start a hotfix"
              : "Start a new hotfix branch"
          }
        >
          <AlertTriangle className="w-3.5 h-3.5 text-ctp-peach" />
          <span>Hotfix</span>
        </button>
      </div>

      {/* Finish buttons */}
      <div className="space-y-1.5">
        <h4 className="text-xs text-ctp-overlay0 uppercase tracking-wider">
          Finish
        </h4>

        <button
          type="button"
          onClick={() => setShowFinishDialog("feature")}
          disabled={!status.canFinishFeature || isLoading}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded hover:bg-ctp-surface0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Square className="w-3.5 h-3.5 text-ctp-green" />
          <span>Finish Feature</span>
        </button>

        <button
          type="button"
          onClick={() => setShowFinishDialog("release")}
          disabled={!status.canFinishRelease || isLoading}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded hover:bg-ctp-surface0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Square className="w-3.5 h-3.5 text-ctp-blue" />
          <span>Finish Release</span>
        </button>

        <button
          type="button"
          onClick={() => setShowFinishDialog("hotfix")}
          disabled={!status.canFinishHotfix || isLoading}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded hover:bg-ctp-surface0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Square className="w-3.5 h-3.5 text-ctp-peach" />
          <span>Finish Hotfix</span>
        </button>
      </div>

      {/* Reference */}
      <div className="pt-1.5 border-t border-ctp-surface0">
        <button
          type="button"
          onClick={() =>
            openBlade("gitflow-cheatsheet", {} as Record<string, never>)
          }
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded hover:bg-ctp-surface0 transition-colors text-ctp-subtext1"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Gitflow Guide</span>
        </button>
      </div>

      {/* Dialogs */}
      {showStartDialog && (
        <StartFlowDialog
          flowType={showStartDialog}
          onClose={() => setShowStartDialog(null)}
        />
      )}
      {showFinishDialog && (
        <FinishFlowDialog
          flowType={showFinishDialog}
          onClose={() => setShowFinishDialog(null)}
        />
      )}
    </div>
  );
}
