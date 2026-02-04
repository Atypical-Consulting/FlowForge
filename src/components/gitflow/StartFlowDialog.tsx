import { X } from "lucide-react";
import { useState } from "react";
import { useBranchStore } from "../../stores/branches";
import { useGitflowStore } from "../../stores/gitflow";

interface StartFlowDialogProps {
  flowType: "feature" | "release" | "hotfix";
  onClose: () => void;
}

const config = {
  feature: {
    title: "Start Feature",
    label: "Feature name",
    placeholder: "my-feature-name",
    prefix: "feature/",
  },
  release: {
    title: "Start Release",
    label: "Version",
    placeholder: "1.0.0",
    prefix: "release/",
  },
  hotfix: {
    title: "Start Hotfix",
    label: "Hotfix name",
    placeholder: "fix-critical-bug",
    prefix: "hotfix/",
  },
};

export function StartFlowDialog({ flowType, onClose }: StartFlowDialogProps) {
  const { startFeature, startRelease, startHotfix, isLoading, error } =
    useGitflowStore();
  const { loadBranches } = useBranchStore();
  const [name, setName] = useState("");

  const { title, label, placeholder, prefix } = config[flowType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let result: string | null = null;
    switch (flowType) {
      case "feature":
        result = await startFeature(name.trim());
        break;
      case "release":
        result = await startRelease(name.trim());
        break;
      case "hotfix":
        result = await startHotfix(name.trim());
        break;
    }

    if (result) {
      await loadBranches();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 w-96 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="flow-name"
              className="block text-sm text-gray-400 mb-1.5"
            >
              {label}
            </label>
            <input
              id="flow-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={placeholder}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Branch will be created as{" "}
              <code className="text-gray-400">
                {prefix}
                {name || "..."}
              </code>
            </p>
          </div>

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
              disabled={!name.trim() || isLoading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Starting..." : "Start"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
