import { useQuery } from "@tanstack/react-query";
import { commands } from "../../bindings";

/**
 * Hook to load a file's content from the repository at HEAD.
 *
 * Returns { content, isBinary, size } on success.
 * Uses react-query for caching with 60s stale time.
 */
export function useRepoFile(filePath: string) {
  return useQuery({
    queryKey: ["repoFile", filePath],
    queryFn: async () => {
      const result = await commands.readRepoFile(filePath);
      if (result.status === "ok") {
        return result.data;
      }
      throw new Error(
        result.error.type === "EmptyRepository"
          ? "Repository has no commits"
          : `Failed to read file: ${filePath}`
      );
    },
    staleTime: 60_000,
    retry: 1,
  });
}
