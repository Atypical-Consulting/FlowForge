import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FocusEvent, useCallback, useMemo, useRef, useState } from "react";
import type { FileChange } from "../../bindings";
import { commands } from "../../bindings";
import { useBladeNavigation } from "../../hooks/useBladeNavigation";
import { useStagingKeyboard } from "./hooks/useStagingKeyboard";
import { useUIStore as useStagingStore } from "../../stores/domain/ui-state";
import { SplitPaneLayout } from "../../components/layout";
import { StagingDiffPreview } from "./components/StagingDiffPreview";
import { StagingPanel } from "./components/StagingPanel";

export function StagingChangesBlade() {
  const { openStagingDiff } = useBladeNavigation();
  const queryClient = useQueryClient();
  const { stagingSelectedFile: selectedFile, stagingSelectedSection: selectedSection, selectFile } = useStagingStore();
  const [fileListFocused, setFileListFocused] = useState(false);
  const fileListRef = useRef<HTMLDivElement>(null);

  const handleFocus = useCallback(() => setFileListFocused(true), []);
  const handleBlur = useCallback((e: FocusEvent<HTMLDivElement>) => {
    // Only mark as unfocused if focus truly left the container
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setFileListFocused(false);
    }
  }, []);

  // Share the staging status query (same cache as StagingPanel)
  const { data: statusResult } = useQuery({
    queryKey: ["stagingStatus"],
    queryFn: () => commands.getStagingStatus(),
    refetchInterval: 2000,
  });

  // Build flat ordered file list for navigation
  const allFiles = useMemo(() => {
    if (!statusResult || statusResult.status !== "ok") return [];
    const s = statusResult.data;
    return [
      ...s.staged.map((f) => ({ file: f, section: "staged" as const })),
      ...s.unstaged.map((f) => ({ file: f, section: "unstaged" as const })),
      ...s.untracked.map((f) => ({ file: f, section: "untracked" as const })),
    ];
  }, [statusResult]);

  const currentIndex = useMemo(
    () => allFiles.findIndex((item) => item.file.path === selectedFile?.path),
    [allFiles, selectedFile?.path],
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allFiles.length - 1;

  const handleExpand = useCallback(() => {
    if (selectedFile && selectedSection) {
      openStagingDiff(selectedFile, selectedSection);
    }
  }, [selectedFile, selectedSection, openStagingDiff]);

  const handleToggleStage = useCallback(() => {
    if (!selectedFile || !selectedSection) return;
    if (selectedSection === "staged") {
      commands
        .unstageFile(selectedFile.path)
        .then(() =>
          queryClient.invalidateQueries({ queryKey: ["stagingStatus"] }),
        );
    } else {
      commands
        .stageFile(selectedFile.path)
        .then(() =>
          queryClient.invalidateQueries({ queryKey: ["stagingStatus"] }),
        );
    }
  }, [selectedFile, selectedSection, queryClient]);

  const handleNavigateFile = useCallback(
    (direction: "next" | "prev") => {
      const newIndex =
        direction === "next" ? currentIndex + 1 : currentIndex - 1;
      const entry = allFiles[newIndex];
      if (entry) {
        selectFile(entry.file, entry.section);
      }
    },
    [currentIndex, allFiles, selectFile],
  );

  useStagingKeyboard({
    allFiles,
    enabled: fileListFocused,
    onExpand: handleExpand,
    onToggleStage: handleToggleStage,
  });

  return (
    <SplitPaneLayout
      autoSaveId="staging-split"
      primaryDefaultSize={40}
      primaryMinSize={20}
      primaryMaxSize={60}
      detailMinSize={30}
      primary={
        <div
          ref={fileListRef}
          tabIndex={0}
          role="region"
          aria-label="Changed files"
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="h-full outline-none"
        >
          <StagingPanel />
        </div>
      }
      detail={
        <div role="region" aria-label="Diff preview" className="h-full">
          <StagingDiffPreview
            file={selectedFile}
            section={selectedSection}
            onExpand={handleExpand}
            onNavigateFile={handleNavigateFile}
            hasPrev={hasPrev}
            hasNext={hasNext}
          />
        </div>
      }
    />
  );
}
