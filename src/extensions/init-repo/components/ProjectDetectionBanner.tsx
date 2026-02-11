import { Plus, Sparkles } from "lucide-react";
import { useInitRepoStore } from "../store";

export function ProjectDetectionBanner() {
  const { detectedTypes, selectedTemplates, addTemplate } = useInitRepoStore();

  if (detectedTypes.length === 0) return null;

  const detectedLabel = detectedTypes.map((d) => d.projectType).join(", ");

  // Collect all recommended templates from all detected types, deduplicated
  const allRecommended = [
    ...new Set(detectedTypes.flatMap((d) => d.recommendedTemplates)),
  ];

  return (
    <div
      className="flex items-start gap-3 p-3 bg-ctp-blue/10 border border-ctp-blue/30 rounded-lg"
      role="status"
      aria-live="polite"
    >
      <Sparkles className="w-4 h-4 text-ctp-blue shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ctp-text">
          Detected: <span className="font-medium">{detectedLabel}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {allRecommended.map((tpl) => {
            const isSelected = selectedTemplates.includes(tpl);
            return isSelected ? (
              <span
                key={tpl}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-ctp-blue/20 text-ctp-blue/70 border border-ctp-blue/20"
              >
                {tpl}
              </span>
            ) : (
              <button
                key={tpl}
                type="button"
                onClick={() => addTemplate(tpl)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-ctp-blue/20 text-ctp-blue border border-ctp-blue/30 hover:bg-ctp-blue/30 transition-colors"
              >
                <Plus className="w-3 h-3" />
                {tpl}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
