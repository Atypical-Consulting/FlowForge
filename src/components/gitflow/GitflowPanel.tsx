import { AlertTriangle, Flag, Play, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useBranchStore } from "../../stores/branches";
import { useGitflowStore } from "../../stores/gitflow";
import { FinishFlowDialog } from "./FinishFlowDialog";
import { StartFlowDialog } from "./StartFlowDialog";

type FlowType = "feature" | "release" | "hotfix";

export function GitflowPanel() {
  const { status, isLoading, error, refresh, abort, clearError } =
    useGitflowStore();
  const { branches } = useBranchStore();
  const [showStartDialog, setShowStartDialog] = useState<FlowType | null>(null);
  const [showFinishDialog, setShowFinishDialog] = useState<FlowType | null>(
    null,
  );

  // Refresh gitflow status when branches change (includes checkout, create, delete)
  useEffect(() => {
    refresh();
  }, [refresh, branches]);

  if (!status) {
    return (
      <div className="p-3 text-ctp-overlay1 text-sm">
        {isLoading
          ? "Loading gitflow status..."
          : "No gitflow status available"}
      </div>
    );
  }

  if (!status.isGitflowReady) {
    return (
      <div className="p-3">
        <div className="flex items-center gap-2 text-ctp-yellow text-sm mb-2">
          <AlertTriangle className="w-4 h-4" />
          <span>Gitflow not initialized</span>
        </div>
        <p className="text-ctp-overlay1 text-xs">
          Repository needs both <code className="text-ctp-subtext1">main</code>{" "}
          and <code className="text-ctp-subtext1">develop</code> branches for
          Gitflow workflows.
        </p>
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
                className="p-1.5 hover:bg-ctp-red/20 rounded text-ctp-red hover:text-ctp-red"
                title="Abort current flow"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-ctp-red/20 border border-ctp-red/50 rounded p-2.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-ctp-red text-xs">{error}</span>
            <button
              type="button"
              onClick={clearError}
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
