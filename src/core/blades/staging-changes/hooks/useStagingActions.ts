import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commands } from "../../../../bindings";

/**
 * Shared hook extracting staging mutations with consistent query invalidation.
 * Replaces duplicated mutation logic across FileItem, StagingPanel, etc.
 */
export function useStagingActions() {
  const queryClient = useQueryClient();

  const invalidateStaging = () => {
    queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
  };

  const invalidateStagingAndDiff = (filePath?: string) => {
    queryClient.invalidateQueries({ queryKey: ["stagingStatus"] });
    if (filePath) {
      queryClient.invalidateQueries({ queryKey: ["fileDiff", filePath] });
      queryClient.invalidateQueries({
        queryKey: ["fileDiffHunks", filePath],
      });
    }
  };

  const stageFile = useMutation({
    mutationFn: (path: string) => commands.stageFile(path),
    onSuccess: () => invalidateStaging(),
  });

  const unstageFile = useMutation({
    mutationFn: (path: string) => commands.unstageFile(path),
    onSuccess: () => invalidateStaging(),
  });

  return {
    stageFile,
    unstageFile,
    invalidateStaging,
    invalidateStagingAndDiff,
  };
}
