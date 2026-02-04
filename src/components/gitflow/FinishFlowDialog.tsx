import { X } from "lucide-react";
import { useState } from "react";
import { useBranchStore } from "../../stores/branches";
import { useGitflowStore } from "../../stores/gitflow";

interface FinishFlowDialogProps {
  flowType: "feature" | "release" | "hotfix";
  onClose: () => void;
}

export function FinishFlowDialog({ flowType, onClose }: FinishFlowDialogProps) {
  const { status, finishFeature, finishRelease, finishHotfix, isLoading, error } =
    useGitflowStore();
  const { loadBranches } = useBranchStore();
  const [tagMessage, setTagMessage] = useState("");

  const needsTagMessage = flowType === "release" || flowType === "hotfix";
  const flowName = status?.activeFlow?.name || "";

  const getDescription = () => {
    switch (flowType) {
      case "feature":
        return (
          <>
            Merge{" "}
            <code className="text-blue-400 bg-gray-800 px-1 rounded">
              feature/{flowName}
            </code>{" "}
            into develop
          </>
        );
      case "release":
        return (
          <>
            Merge{" "}
            <code className="text-blue-400 bg-gray-800 px-1 rounded">
              release/{flowName}
            </code>{" "}
            into main and develop, create tag
          </>
        );
      case "hotfix":
        return (
          <>
            Merge{" "}
            <code className="text-blue-400 bg-gray-800 px-1 rounded">
              hotfix/{flowName}
            </code>{" "}
            into main and develop, create tag
          </>
        );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let success = false;
    switch (flowType) {
      case "feature":
        success = await finishFeature();
        break;
      case "release":
        success = !!(await finishRelease(tagMessage || undefined));
        break;
      case "hotfix":
        success = !!(await finishHotfix(tagMessage || undefined));
        break;
    }

    if (success) {
      await loadBranches();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 w-96 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Finish {flowType.charAt(0).toUpperCase() + flowType.slice(1)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-400">{getDescription()}</p>

          {needsTagMessage && (
            <div>
              <label
                htmlFor="tag-message"
                className="block text-sm text-gray-400 mb-1.5"
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
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Finishing..." : "Finish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
