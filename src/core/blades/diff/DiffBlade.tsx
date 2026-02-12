import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useDiffQuery } from "./hooks/useDiffQuery";
import { useDiffPreferences } from "./hooks/useDiffPreferences";
import { DiffContent } from "./components/DiffContent";
import { DiffToolbar } from "./components/DiffToolbar";
import { DiffMarkdownPreview } from "./components/DiffMarkdownPreview";
import { StagingDiffNavigation } from "./components/StagingDiffNavigation";
import type { DiffSource } from "./types";

interface DiffBladeProps {
  source: DiffSource;
}

export function DiffBlade({ source }: DiffBladeProps) {
  const { viewMode, setDiffViewMode } = useDiffPreferences();
  const inline = viewMode === "inline";

  const [showPreview, setShowPreview] = useState(false);
  const isMarkdown =
    source.filePath.toLowerCase().endsWith(".md") ||
    source.filePath.toLowerCase().endsWith(".mdx");

  const { data: result, isLoading, error } = useDiffQuery(source);

  const handleToggleInline = useCallback(() => {
    setDiffViewMode(inline ? "side-by-side" : "inline");
  }, [inline, setDiffViewMode]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
      </div>
    );
  }

  if (error || !result || result.status === "error") {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <p className="text-ctp-red text-sm">Failed to load diff</p>
      </div>
    );
  }

  const diff = result.data;

  if (diff.isBinary) {
    return (
      <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
        <p className="text-ctp-overlay1 text-sm">
          Binary file - diff not available
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <DiffToolbar
        inline={inline}
        onToggleInline={handleToggleInline}
        isMarkdown={isMarkdown}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview((v) => !v)}
        trailing={
          source.mode === "staging" ? (
            <StagingDiffNavigation currentFilePath={source.filePath} />
          ) : undefined
        }
      />
      {showPreview && isMarkdown ? (
        <DiffMarkdownPreview
          content={diff.newContent}
          filePath={source.filePath}
        />
      ) : (
        <DiffContent
          original={diff.oldContent}
          modified={diff.newContent}
          language={diff.language}
          inline={inline}
        />
      )}
    </div>
  );
}
