import { X } from "lucide-react";
import { useState } from "react";
import { useGitflowWorkflow } from "../hooks/useGitflowWorkflow";
import { useGitOpsStore as useGitflowStore } from "../../../core/stores/domain/git-ops";
import { ReviewChecklist } from "./ReviewChecklist";

interface FinishFlowDialogProps {
  flowType: "feature" | "release" | "hotfix";
  onClose: () => void;
}

export function FinishFlowDialog({ flowType, onClose }: FinishFlowDialogProps) {
  const { gitflowStatus: status } = useGitflowStore();
  const { isBusy: isLoading, error, finishOperation } = useGitflowWorkflow();
  const [tagMessage, setTagMessage] = useState("");

  const needsTagMessage = flowType === "release" || flowType === "hotfix";
  const flowName = status?.activeFlow?.name || "";

  const getDescription = () => {
    switch (flowType) {
      case "feature":
        return (
          <>
            Merge{" "}
            <code className="text-ctp-blue bg-ctp-surface0 px-1 rounded">
              feature/{flowName}
            </code>{" "}
            into develop
          </>
        );
      case "release":
        return (
          <>
            Merge{" "}
            <code className="text-ctp-blue bg-ctp-surface0 px-1 rounded">
              release/{flowName}
            </code>{" "}
            into main and develop, create tag
          </>
        );
      case "hotfix":
        return (
          <>
            Merge{" "}
            <code className="text-ctp-blue bg-ctp-surface0 px-1 rounded">
              hotfix/{flowName}
            </code>{" "}
            into main and develop, create tag
          </>
        );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    finishOperation(flowType, tagMessage || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-5 w-96 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Finish {flowType.charAt(0).toUpperCase() + flowType.slice(1)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-ctp-surface0 rounded text-ctp-overlay1 hover:text-ctp-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-ctp-overlay1">{getDescription()}</p>

          <ReviewChecklist flowType={flowType} />

          {needsTagMessage && (
            <div>
              <label
                htmlFor="tag-message"
                className="block text-sm text-ctp-overlay1 mb-1.5"
              >
                Tag message (optional)
              </label>
              <input
                id="tag-message"
                type="text"
                value={tagMessage}
                onChange={(e) => setTagMessage(e.target.value)}
                placeholder={
                  flowType === "release"
                    ? `Release ${flowName}`
                    : `Hotfix ${flowName}`
                }
                className="w-full px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded text-sm focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue"
              />
            </div>
          )}

          {error && <p className="text-ctp-red text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-ctp-overlay1 hover:text-ctp-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm bg-ctp-green hover:bg-ctp-green/80 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Finishing..." : "Finish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
