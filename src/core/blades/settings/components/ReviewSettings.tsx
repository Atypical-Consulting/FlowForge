import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { usePreferencesStore as useReviewChecklistStore } from "../../../stores/domain/preferences";
import {
  DEFAULT_CHECKLIST,
  type FlowType,
} from "../../../stores/domain/preferences/review-checklist.slice";

const inputClassName =
  "w-full max-w-xs px-3 py-2 bg-ctp-surface0 border border-ctp-surface1 rounded-md text-sm text-ctp-text placeholder-ctp-overlay0 focus:outline-none focus:ring-2 focus:ring-ctp-blue focus:border-transparent";

const FLOW_TYPES: { type: FlowType; label: string }[] = [
  { type: "feature", label: "Feature" },
  { type: "release", label: "Release" },
  { type: "hotfix", label: "Hotfix" },
];

function FlowSection({
  flowType,
  label,
}: {
  flowType: FlowType;
  label: string;
}) {
  const {
    getChecklistItems: getItems,
    updateChecklistItems: updateItems,
    resetChecklistToDefaults: resetToDefaults,
  } = useReviewChecklistStore();
  const items = getItems(flowType);
  const [newLabel, setNewLabel] = useState("");

  const handleDelete = useCallback(
    (id: string) => {
      updateItems(
        flowType,
        items.filter((item) => item.id !== id),
      );
    },
    [flowType, items, updateItems],
  );

  const handleAdd = useCallback(() => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const id = `${flowType[0]}${Date.now()}`;
    updateItems(flowType, [...items, { id, label: trimmed }]);
    setNewLabel("");
  }, [flowType, items, newLabel, updateItems]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd],
  );

  const isDefault =
    JSON.stringify(items) === JSON.stringify(DEFAULT_CHECKLIST[flowType]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium text-ctp-text">{label}</h3>
        {!isDefault && (
          <button
            type="button"
            onClick={() => resetToDefaults(flowType)}
            className="flex items-center gap-1 text-ctp-blue text-xs hover:underline"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to defaults
          </button>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <span className="flex-1 text-sm text-ctp-subtext1">
              {item.label}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              className="p-1 text-ctp-overlay0 hover:text-ctp-red transition-colors rounded"
              aria-label={`Delete "${item.label}"`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add checklist item..."
            className={inputClassName}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newLabel.trim()}
            className="p-2 text-ctp-blue hover:bg-ctp-surface0 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Add item"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReviewSettings() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-ctp-subtext0">
        Configure the review checklist items shown before finishing Gitflow
        branches. These are advisory only and never block the finish action.
      </p>

      {FLOW_TYPES.map(({ type, label }) => (
        <FlowSection key={type} flowType={type} label={label} />
      ))}
    </div>
  );
}
