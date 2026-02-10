import { GitMerge } from "lucide-react";
import { useGitOpsStore as useGitflowStore } from "../../../stores/domain/git-ops";
import { useGitOpsStore as useRepositoryStore } from "../../../stores/domain/git-ops";
import { classifyBranch, BRANCH_TYPE_COLORS } from "../../../lib/branchClassifier";
import type { GitflowBranchType } from "../../../lib/branchClassifier";
import { GitflowDiagram } from "../components/GitflowDiagram";
import { GitflowActionCards } from "../components/GitflowActionCards";
import { GitflowBranchReference } from "../components/GitflowBranchReference";

export function GitflowCheatsheetBlade() {
  const gitflowStatus = useGitflowStore((s) => s.gitflowStatus);
  const repoStatus = useRepositoryStore((s) => s.repoStatus);

  // Determine branch type from current branch name
  // Prefer gitflow status (has currentBranch), fall back to repo status (has branchName)
  const branchName = gitflowStatus?.currentBranch || repoStatus?.branchName || "";
  const branchType: GitflowBranchType = branchName
    ? classifyBranch(branchName)
    : "other";

  return (
    <div className="flex-1 overflow-y-auto h-full bg-ctp-base">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <GitMerge className="w-6 h-6 text-ctp-mauve" />
          <div>
            <h1 className="text-lg font-bold text-ctp-text">
              Gitflow Workflow Guide
            </h1>
            <p className="text-xs text-ctp-subtext0">
              A branching model for structured release management
            </p>
          </div>
        </div>

        {/* SVG Diagram */}
        <div className="shrink-0">
          <GitflowDiagram
            highlightedLane={branchType !== "other" ? branchType : undefined}
          />
        </div>

        {/* "You are here" section */}
        <div className="bg-ctp-surface0/30 border border-ctp-surface1 rounded-lg p-4">
          {branchName ? (
            <>
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full motion-safe:animate-gentle-pulse"
                  style={{ backgroundColor: BRANCH_TYPE_COLORS[branchType] }}
                />
                <p className="text-sm text-ctp-text">
                  You are on{" "}
                  <code className="bg-ctp-crust text-ctp-peach px-1.5 py-0.5 rounded text-xs font-mono">
                    {branchName}
                  </code>
                </p>
              </div>
              {branchType === "other" && (
                <p className="text-xs text-ctp-overlay0 mt-1 ml-5">
                  This branch does not match a gitflow naming pattern
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-ctp-overlay0">
              No branch detected — open a repository to see your position
            </p>
          )}
        </div>

        {/* Action Cards */}
        <GitflowActionCards branchType={branchType} />

        {/* Branch Reference */}
        <GitflowBranchReference currentBranchType={branchType} />
      </div>
    </div>
  );
}
