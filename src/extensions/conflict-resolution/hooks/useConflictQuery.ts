import { useQuery } from "@tanstack/react-query";
import { useConflictStore } from "../store";

export function useConflictFiles() {
  const loadConflictFiles = useConflictStore((s) => s.loadConflictFiles);

  return useQuery({
    queryKey: ["conflictFiles"],
    queryFn: loadConflictFiles,
    refetchInterval: 3000,
  });
}

export function useConflictFileContent(path: string | null) {
  const openConflictFile = useConflictStore((s) => s.openConflictFile);

  return useQuery({
    queryKey: ["conflictContent", path],
    queryFn: () => openConflictFile(path!),
    enabled: !!path,
  });
}
