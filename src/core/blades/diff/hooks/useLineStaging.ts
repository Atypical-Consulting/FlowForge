import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useRef } from "react";
import { commands } from "../../../../bindings";
import type { DiffHunkDetail } from "../../../../bindings";
import { findHunkForLine, linesToRanges } from "../lib/diffUtils";

interface UseLineStagingOptions {
  filePath: string;
  staged: boolean;
  hunks: DiffHunkDetail[];
}

export function useLineStaging({ filePath, staged, hunks }: UseLineStagingOptions) {
  const queryClient = useQueryClient();
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set());
  const lastClickedLine = useRef<number | null>(null);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
    queryClient.invalidateQueries({ queryKey: ["fileDiff", filePath] });
    queryClient.invalidateQueries({ queryKey: ["fileDiffHunks", filePath] });
  }, [queryClient, filePath]);

  const toggleLine = useCallback((lineNumber: number) => {
    setSelectedLines(prev => {
      const next = new Set(prev);
      if (next.has(lineNumber)) next.delete(lineNumber);
      else next.add(lineNumber);
      return next;
    });
    lastClickedLine.current = lineNumber;
  }, []);

  const selectRange = useCallback((toLine: number) => {
    const fromLine = lastClickedLine.current ?? toLine;
    const start = Math.min(fromLine, toLine);
    const end = Math.max(fromLine, toLine);
    setSelectedLines(prev => {
      const next = new Set(prev);
      for (let i = start; i <= end; i++) next.add(i);
      return next;
    });
    lastClickedLine.current = toLine;
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLines(new Set());
    lastClickedLine.current = null;
  }, []);

  const stageLinesMutation = useMutation({
    mutationFn: async () => {
      const hunkIndex = findHunkForLineFromSelection(selectedLines, hunks);
      if (hunkIndex < 0) throw new Error("No hunk found for selection");
      const ranges = linesToRanges(selectedLines);
      const result = await commands.stageLines(filePath, hunkIndex, ranges);
      if (result.status === "error") throw new Error(String(result.error));
      return result.data;
    },
    onSuccess: () => {
      clearSelection();
      invalidateAll();
    },
  });

  const unstageLinesMutation = useMutation({
    mutationFn: async () => {
      const hunkIndex = findHunkForLineFromSelection(selectedLines, hunks);
      if (hunkIndex < 0) throw new Error("No hunk found for selection");
      const ranges = linesToRanges(selectedLines);
      const result = await commands.unstageLines(filePath, hunkIndex, ranges);
      if (result.status === "error") throw new Error(String(result.error));
      return result.data;
    },
    onSuccess: () => {
      clearSelection();
      invalidateAll();
    },
  });

  const stageSelectedLines = useCallback(() => {
    if (selectedLines.size === 0) return;
    if (staged) unstageLinesMutation.mutate();
    else stageLinesMutation.mutate();
  }, [selectedLines, staged, stageLinesMutation, unstageLinesMutation]);

  const isLineStagingPending =
    stageLinesMutation.isPending || unstageLinesMutation.isPending;

  return {
    selectedLines,
    toggleLine,
    selectRange,
    clearSelection,
    stageSelectedLines,
    isLineStagingPending,
    hasSelection: selectedLines.size > 0,
  };
}

function findHunkForLineFromSelection(
  selectedLines: Set<number>,
  hunks: DiffHunkDetail[],
): number {
  if (selectedLines.size === 0) return -1;
  const firstLine = Math.min(...selectedLines);
  return findHunkForLine(hunks, firstLine);
}
