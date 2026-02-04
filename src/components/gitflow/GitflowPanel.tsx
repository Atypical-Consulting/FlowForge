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
      <div className="p-3 text-gray-400 text-sm">
        {isLoading
          ? "Loading gitflow status..."
          : "No gitflow status available"}
      </div>
    );
  }

  if (!status.isGitflowReady) {
    return (
      <div className="p-3">
        <div className="flex items-center gap-2 text-yellow-500 text-sm mb-2">
          <AlertTriangle className="w-4 h-4" />
          <span>Gitflow not initialized</span>
        </div>
        <p className="text-gray-400 text-xs">
          Repository needs both <code className="text-gray-300">main</code> and{" "}
          <code className="text-gray-300">develop</code> branches for Gitflow
          workflows.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Active flow indicator */}
      {status.activeFlow && (
        <div className="bg-purple-900/30 border border-purple-700/50 rounded p-2.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-purple-300 text-xs uppercase tracking-wider">
                {status.activeFlow.flowType}
              </span>
              <p className="font-medium text-sm">{status.activeFlow.name}</p>
            </div>
            {status.canAbort && (
              <button
                type="button"
                onClick={() => abort()}
                className="p-1.5 hover:bg-red-900/50 rounded text-red-400 hover:text-red-300"
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
        <div className="bg-red-900/30 border border-red-700/50 rounded p-2.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-red-300 text-xs">{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="text-red-400 hover:text-red-300 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Start buttons */}
      <div className="space-y-1.5">
        <h4 className="text-xs text-gray-500 uppercase tracking-wider">
          Start
        </h4>

        <button
          type="button"
          onClick={() => setShowStartDialog("feature")}
          disabled={!status.canStartFeature || isLoading}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={
            !status.canStartFeature
              ? "Switch to develop branch to start a feature"
              : "Start a new feature branch"
          }
        >
          <Play className="w-3.5 h-3.5 text-green-400" />
          <span>Feature</span>
        </button>

        <button
          type="button"
          onClick={() => setShowStartDialog("release")}
          disabled={!status.canStartRelease || isLoading}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={
            !status.canStartRelease
              ? "Switch to develop branch (no active release)"
              : "Start a new release branch"
          }
        >
          <Flag className="w-3.5 h-3.5 text-blue-400" />
          <span>Release</span>
        </button>

        <button
          type="button"
          onClick={() => setShowStartDialog("hotfix")}
          disabled={!status.canStartHotfix || isLoading}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={
            !status.canStartHotfix
              ? "Switch to main branch to start a hotfix"
              : "Start a new hotfix branch"
          }
        >
          <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
          <span>Hotfix</span>
        </button>
      </div>

      {/* Finish buttons */}
      <div className="space-y-1.5">
        <h4 className="text-xs text-gray-500 uppercase tracking-wider">
          Finish
        </h4>

        <button
          type="button"
          onClick={() => setShowFinishDialog("feature")}
          disabled={!status.canFinishFeature || isLoading}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Square className="w-3.5 h-3.5 text-green-400" />
          <span>Finish Feature</span>
        </button>

        <button
          type="button"
          onClick={() => setShowFinishDialog("release")}
          disabled={!status.canFinishRelease || isLoading}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Square className="w-3.5 h-3.5 text-blue-400" />
          <span>Finish Release</span>
        </button>

        <button
          type="button"
          onClick={() => setShowFinishDialog("hotfix")}
          disabled={!status.canFinishHotfix || isLoading}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left rounded hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Square className="w-3.5 h-3.5 text-orange-400" />
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
