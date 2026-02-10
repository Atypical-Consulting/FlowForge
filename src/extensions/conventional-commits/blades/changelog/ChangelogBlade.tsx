import { cn } from "../../../../lib/utils";
import { useChangelogStore } from "./store";
import { useBladeNavigation } from "../../../../hooks/useBladeNavigation";
import { ChangelogPreview } from "./components/ChangelogPreview";
import { Button } from "../../../../components/ui/button";

export function ChangelogBlade() {
  const {
    fromRef,
    toRef,
    version,
    setFromRef,
    setToRef,
    setVersion,
    changelog,
    isGenerating,
    error,
    generate,
    reset,
  } = useChangelogStore();
  const { goBack } = useBladeNavigation();

  const handleDone = () => {
    reset();
    goBack();
  };

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      {/* Options form - shown before generation */}
      {!changelog && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-ctp-subtext1">
                From (tag/commit)
              </label>
              <input
                type="text"
                value={fromRef}
                onChange={(e) => setFromRef(e.target.value)}
                placeholder="e.g., v1.0.0 (leave empty for all)"
                className={cn(
                  "w-full px-3 py-2 text-sm bg-ctp-surface0 border border-ctp-surface1 rounded",
                  "text-ctp-text placeholder:text-ctp-overlay0",
                  "focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue",
                )}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-ctp-subtext1">
                To (tag/commit)
              </label>
              <input
                type="text"
                value={toRef}
                onChange={(e) => setToRef(e.target.value)}
                placeholder="HEAD"
                className={cn(
                  "w-full px-3 py-2 text-sm bg-ctp-surface0 border border-ctp-surface1 rounded",
                  "text-ctp-text placeholder:text-ctp-overlay0",
                  "focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue",
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-ctp-subtext1">
              Version (optional)
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g., 1.1.0 (for changelog header)"
              className={cn(
                "w-full px-3 py-2 text-sm bg-ctp-surface0 border border-ctp-surface1 rounded",
                "text-ctp-text placeholder:text-ctp-overlay0",
                "focus:outline-none focus:border-ctp-blue focus:ring-1 focus:ring-ctp-blue",
              )}
            />
          </div>

          {error && (
            <div className="p-3 bg-ctp-red/10 border border-ctp-red/20 rounded text-ctp-red text-sm">
              {error}
            </div>
          )}

          <Button
            onClick={generate}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? "Generating..." : "Generate Changelog"}
          </Button>
        </div>
      )}

      {/* Preview - shown after generation */}
      {changelog && (
        <div className="space-y-4">
          <ChangelogPreview changelog={changelog} />

          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} className="flex-1">
              Generate Another
            </Button>
            <Button onClick={handleDone}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}
