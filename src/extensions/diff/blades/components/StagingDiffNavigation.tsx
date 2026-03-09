import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useBladeNavigation } from "@/core/hooks/useBladeNavigation";
import { useUIStore as useStagingStore } from "@/core/stores/domain/ui-state";
import { commands } from "../../../../bindings";

interface StagingDiffNavigationProps {
  currentFilePath: string;
}

export function StagingDiffNavigation({
  currentFilePath,
}: StagingDiffNavigationProps) {
  const { selectFile } = useStagingStore();
  const { replaceBlade } = useBladeNavigation();

  const { data: statusResult } = useQuery({
    queryKey: ["stagingStatus"],
    queryFn: () => commands.getStagingStatus(),
  });

  const allFiles = useMemo(() => {
    if (!statusResult || statusResult.status !== "ok") return [];
    const s = statusResult.data;
    return [
      ...s.staged.map((f) => ({ file: f, section: "staged" as const })),
      ...s.unstaged.map((f) => ({ file: f, section: "unstaged" as const })),
      ...s.untracked.map((f) => ({
        file: f,
        section: "untracked" as const,
      })),
    ];
  }, [statusResult]);

  const currentIndex = allFiles.findIndex(
    (f) => f.file.path === currentFilePath,
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allFiles.length - 1;

  const navigateTo = useCallback(
    (index: number) => {
      const entry = allFiles[index];
      if (!entry) return;
      selectFile(entry.file, entry.section);
      replaceBlade({
        type: "diff",
        title: entry.file.path.split("/").pop() || entry.file.path,
        props: {
          source: {
            mode: "staging",
            filePath: entry.file.path,
            staged: entry.section === "staged",
          },
        },
      });
    },
    [allFiles, selectFile, replaceBlade],
  );

  useHotkeys(
    "alt+up",
    () => hasPrev && navigateTo(currentIndex - 1),
    { enabled: hasPrev, enableOnFormTags: false, preventDefault: true },
    [currentIndex, hasPrev, navigateTo],
  );

  useHotkeys(
    "alt+down",
    () => hasNext && navigateTo(currentIndex + 1),
    { enabled: hasNext, enableOnFormTags: false, preventDefault: true },
    [currentIndex, hasNext, navigateTo],
  );

  if (allFiles.length <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={!hasPrev}
        onClick={() => navigateTo(currentIndex - 1)}
        className="p-1 rounded hover:bg-ctp-surface0 disabled:opacity-30 disabled:cursor-default text-ctp-overlay1 hover:text-ctp-text transition-colors"
        aria-label="Previous file"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-xs text-ctp-overlay0 tabular-nums">
        {currentIndex + 1} / {allFiles.length}
      </span>
      <button
        type="button"
        disabled={!hasNext}
        onClick={() => navigateTo(currentIndex + 1)}
        className="p-1 rounded hover:bg-ctp-surface0 disabled:opacity-30 disabled:cursor-default text-ctp-overlay1 hover:text-ctp-text transition-colors"
        aria-label="Next file"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
