import { useState, useCallback } from "react";

export function useBulkSelect(branchNames: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [lastSelected, setLastSelected] = useState<string | null>(null);

  const toggleSelect = useCallback(
    (name: string, shiftKey: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastSelected) {
          const startIdx = branchNames.indexOf(lastSelected);
          const endIdx = branchNames.indexOf(name);
          if (startIdx !== -1 && endIdx !== -1) {
            const [from, to] =
              startIdx < endIdx
                ? [startIdx, endIdx]
                : [endIdx, startIdx];
            for (let i = from; i <= to; i++) {
              next.add(branchNames[i]);
            }
          }
        } else {
          if (next.has(name)) {
            next.delete(name);
          } else {
            next.add(name);
          }
        }
        return next;
      });
      setLastSelected(name);
    },
    [branchNames, lastSelected],
  );

  const selectAllMerged = useCallback((mergedBranchNames: string[]) => {
    setSelected(new Set(mergedBranchNames));
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setLastSelected(null);
  }, []);

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelected(new Set());
    setLastSelected(null);
  }, []);

  return {
    selected,
    selectedCount: selected.size,
    selectionMode,
    toggleSelect,
    selectAllMerged,
    clearSelection,
    enterSelectionMode,
    exitSelectionMode,
    isSelected: (name: string) => selected.has(name),
  };
}
