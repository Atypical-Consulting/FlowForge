import { X } from "lucide-react";
import { useInitRepoStore } from "../../../stores/initRepo";

export function TemplateChips() {
  const { selectedTemplates, removeTemplate, clearTemplates } =
    useInitRepoStore();

  if (selectedTemplates.length === 0) {
    return (
      <p className="text-sm text-ctp-subtext0 italic">
        No templates selected
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selectedTemplates.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm rounded-md bg-ctp-blue/20 text-ctp-blue border border-ctp-blue/30"
          >
            {name}
            <button
              type="button"
              onClick={() => removeTemplate(name)}
              className="hover:bg-ctp-red/20 rounded p-0.5 transition-colors"
              aria-label={`Remove ${name} template`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      {selectedTemplates.length >= 2 && (
        <button
          type="button"
          onClick={clearTemplates}
          className="text-xs text-ctp-subtext0 hover:text-ctp-red cursor-pointer transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
