import { ClipboardCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { FlowType } from "../../../core/stores/domain/preferences/review-checklist.slice";
import { usePreferencesStore as useReviewChecklistStore } from "../../../core/stores/domain/preferences";

interface ReviewChecklistProps {
  flowType: FlowType;
}

export function ReviewChecklist({ flowType }: ReviewChecklistProps) {
  const getItems = useReviewChecklistStore((s) => s.getChecklistItems);
  const items = getItems(flowType);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);

  // Reset checked state when flowType changes (new dialog open)
  useEffect(() => {
    setChecked({});
    setCollapsed(false);
  }, [flowType]);

  if (items.length === 0) return null;

  const checkedCount = Object.values(checked).filter(Boolean).length;

  const toggle = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="border border-ctp-surface1 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between w-full px-3 py-2 bg-ctp-surface0 hover:bg-ctp-surface1 transition-colors text-sm"
      >
        <span className="flex items-center gap-2 text-ctp-subtext1">
          <ClipboardCheck className="w-4 h-4 text-ctp-blue" />
          Review Checklist
        </span>
        <span className="text-xs text-ctp-overlay1">
          {checkedCount}/{items.length} checked
        </span>
      </button>

      {!collapsed && (
        <div className="px-3 py-2 space-y-1.5">
          {items.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={checked[item.id] ?? false}
                onChange={() => toggle(item.id)}
                className="w-4 h-4 rounded border-ctp-surface2 bg-ctp-surface0 text-ctp-blue focus:ring-ctp-blue focus:ring-offset-0"
              />
              <span
                className={`text-sm transition-colors ${
                  checked[item.id]
                    ? "text-ctp-overlay0 line-through"
                    : "text-ctp-text"
                }`}
              >
                {item.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
