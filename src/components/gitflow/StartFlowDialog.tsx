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
  const { startFeature, startRelease, startHotfix, gitflowIsLoading: isLoading, gitflowError: error } =
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
      <div className="bg-ctp-mantle border border-ctp-surface1 rounded-lg p-5 w-96 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-ctp-surface0 rounded text-ctp-overlay1 hover:text-ctp-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="flow-name"
              className="block text-sm text-ctp-overlay1 mb-1.5"
            >
              {label}
            </label>
            <input
              id="flow-name"
              type="text"
              value={name}
              onChange={(e) => {
                // Sanitize: replace spaces with dashes, remove invalid chars
                const sanitized = e.target.value
                  .replace(/\s+/g, "-")
                  .replace(/[^a-zA-Z0-9._-]/g, "");
                setName(sanitized);
              }}
              placeholder={placeholder}
              className="w-full px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded text-sm focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue"
              autoFocus
            />
            <p className="text-xs text-ctp-overlay0 mt-1.5">
              Branch will be created as{" "}
              <code className="text-ctp-overlay1">
                {prefix}
                {name || "..."}
              </code>
            </p>
          </div>

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
              disabled={!name.trim() || isLoading}
              className="px-4 py-2 text-sm bg-ctp-blue hover:bg-ctp-blue/80 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Starting..." : "Start"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
