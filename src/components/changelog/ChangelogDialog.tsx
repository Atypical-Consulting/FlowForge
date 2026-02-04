import { FileText } from "lucide-react";
import { cn } from "../../lib/utils";
import { useChangelogStore } from "../../stores/changelogStore";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { ChangelogPreview } from "./ChangelogPreview";

export function ChangelogDialog() {
  const {
    isDialogOpen,
    closeDialog,
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

  const handleClose = () => {
    closeDialog();
    reset();
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generate Changelog
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Options form - shown before generation */}
          {!changelog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    From (tag/commit)
                  </label>
                  <input
                    type="text"
                    value={fromRef}
                    onChange={(e) => setFromRef(e.target.value)}
                    placeholder="e.g., v1.0.0 (leave empty for all)"
                    className={cn(
                      "w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded",
                      "text-white placeholder:text-gray-500",
                      "focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    To (tag/commit)
                  </label>
                  <input
                    type="text"
                    value={toRef}
                    onChange={(e) => setToRef(e.target.value)}
                    placeholder="HEAD"
                    className={cn(
                      "w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded",
                      "text-white placeholder:text-gray-500",
                      "focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Version (optional)
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="e.g., 1.1.0 (for changelog header)"
                  className={cn(
                    "w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded",
                    "text-white placeholder:text-gray-500",
                    "focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
                  )}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
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
                <Button onClick={handleClose}>Done</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
