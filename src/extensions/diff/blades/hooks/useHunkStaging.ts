import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { commands } from "../../../../bindings";
import type { DiffHunkDetail } from "../../../../bindings";

interface UseHunkStagingOptions {
  filePath: string;
  staged: boolean;
  enabled?: boolean;
}

export function useHunkStaging({
  filePath,
  staged,
  enabled = true,
}: UseHunkStagingOptions) {
  const queryClient = useQueryClient();

  const hunkQuery = useQuery({
    queryKey: ["fileDiffHunks", filePath, staged],
    queryFn: () => commands.getFileDiffHunks(filePath, staged),
    enabled,
    staleTime: 2000,
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
    queryClient.invalidateQueries({ queryKey: ["fileDiff", filePath] });
    queryClient.invalidateQueries({ queryKey: ["fileDiffHunks", filePath] });
  }, [queryClient, filePath]);

  const stageHunksMutation = useMutation({
    mutationFn: async (hunkIndices: number[]) => {
      const result = await commands.stageHunks(filePath, hunkIndices);
      if (result.status === "error") throw new Error(String(result.error));
      return result.data;
    },
    onSuccess: invalidateAll,
  });

  const unstageHunksMutation = useMutation({
    mutationFn: async (hunkIndices: number[]) => {
      const result = await commands.unstageHunks(filePath, hunkIndices);
      if (result.status === "error") throw new Error(String(result.error));
      return result.data;
    },
    onSuccess: invalidateAll,
  });

  const toggleHunk = useCallback(
    (hunkIndex: number) => {
      if (staged) {
        unstageHunksMutation.mutate([hunkIndex]);
      } else {
        stageHunksMutation.mutate([hunkIndex]);
      }
    },
    [staged, stageHunksMutation, unstageHunksMutation],
  );

  const isOperationPending =
    stageHunksMutation.isPending || unstageHunksMutation.isPending;

  const hunks: DiffHunkDetail[] =
    hunkQuery.data?.status === "ok" ? hunkQuery.data.data : [];

  return {
    hunks,
    isLoadingHunks: hunkQuery.isLoading,
    toggleHunk,
    stageHunks: stageHunksMutation.mutate,
    unstageHunks: unstageHunksMutation.mutate,
    isOperationPending,
    invalidateAll,
  };
}
